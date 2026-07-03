"""
Background worker that polls queues and executes jobs.

Uses PostgreSQL FOR UPDATE SKIP LOCKED to atomically claim jobs,
preventing duplicate execution across multiple worker instances.
"""

import logging
import os
import random
import socket
import time
import uuid
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger("worker")

WORKER_ID: uuid.UUID | None = None
HOSTNAME = socket.gethostname()
POLL_INTERVAL = 3  # seconds
HEARTBEAT_INTERVAL = 30  # seconds


def get_engine():
    url = os.environ.get("DATABASE_URL", "")
    return create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=10)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def ai_failure_summary(error: str) -> str:
    """Rule-based AI failure summary without any paid APIs."""
    error_lower = error.lower()
    if "timeout" in error_lower:
        return "Job timed out during execution. Consider increasing the timeout limit or optimizing the payload processing."
    if "connection" in error_lower or "network" in error_lower:
        return "Network connectivity issue detected. The job failed due to a connection error — retrying may resolve this."
    if "memory" in error_lower or "oom" in error_lower:
        return "Memory exhaustion detected. The job consumed more memory than available — reduce payload size or increase limits."
    if "permission" in error_lower or "auth" in error_lower or "forbidden" in error_lower:
        return "Authorization failure. The job was rejected due to insufficient permissions — check credentials."
    if "not found" in error_lower or "404" in error_lower:
        return "Resource not found. The job referenced a resource that no longer exists."
    if "rate limit" in error_lower or "429" in error_lower:
        return "Rate limit exceeded. Too many requests were made — implement exponential backoff."
    if "simulated" in error_lower:
        return "Simulated execution failure for demonstration purposes. This is a test scenario."
    return f"Execution failed with error: {error[:120]}. Review job payload and retry policy."


def calculate_retry_delay(strategy: str, retry_count: int, base_interval: int) -> int:
    if strategy == "fixed":
        return base_interval
    if strategy == "linear":
        return base_interval * (retry_count + 1)
    # exponential
    return min(base_interval * (2 ** retry_count), 3600)


def register_worker(session) -> uuid.UUID:
    from sys import modules
    # Import models lazily to avoid circular import at module load
    sys_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    import sys
    if sys_path not in sys.path:
        sys.path.insert(0, sys_path)
    from backend.app import models

    worker = models.Worker(hostname=HOSTNAME, status="idle")
    session.add(worker)
    session.commit()
    session.refresh(worker)
    logger.info(f"Worker registered: {worker.id} @ {HOSTNAME}")
    return worker.id


def send_heartbeat(session, worker_id: uuid.UUID, running: int):
    from backend.app import models
    worker = session.query(models.Worker).filter(models.Worker.id == worker_id).first()
    if worker:
        worker.last_heartbeat = utcnow()
        worker.running_jobs = running
        worker.cpu_usage = round(random.uniform(5, 45), 2)
        worker.memory_usage = round(random.uniform(20, 70), 2)
        worker.status = "active" if running > 0 else "idle"
        session.commit()


def simulate_job_execution(job_id: uuid.UUID, queue_id: uuid.UUID, worker_id: uuid.UUID, db_url: str):
    """
    Run in a thread pool. Simulates job execution with realistic timing.
    Returns (success: bool, output: str, error: str | None, duration_ms: int).
    """
    eng = create_engine(db_url, pool_pre_ping=True, pool_size=2, max_overflow=5)
    Sess = sessionmaker(bind=eng)
    session = Sess()

    from backend.app import models

    try:
        job = session.query(models.Job).filter(models.Job.id == job_id).with_for_update().first()
        if not job:
            return

        queue = session.query(models.Queue).filter(models.Queue.id == queue_id).first()
        if not queue:
            return

        execution = models.JobExecution(
            job_id=job_id,
            attempt_number=job.retry_count + 1,
            status="running",
            worker_id=worker_id,
            started_at=utcnow(),
        )
        session.add(execution)
        session.add(models.JobLog(
            job_id=job_id,
            execution_id=execution.id,
            level="info",
            message=f"Execution started (attempt {execution.attempt_number})",
            worker_id=worker_id,
        ))
        session.commit()

        # Simulate work
        duration_seconds = random.uniform(0.5, 4.0)
        time.sleep(duration_seconds)
        duration_ms = int(duration_seconds * 1000)

        # 80% success rate
        success = random.random() < 0.80

        now = utcnow()

        if success:
            job.status = "completed"
            job.completed_at = now
            execution.status = "completed"
            execution.completed_at = now
            execution.duration_ms = duration_ms
            execution.output = f"Processed {job.name} successfully in {duration_ms}ms"

            session.add(models.JobLog(
                job_id=job_id,
                execution_id=execution.id,
                level="info",
                message=f"Job completed in {duration_ms}ms",
                worker_id=worker_id,
            ))
            session.add(models.ActivityEvent(
                event_type="job_completed",
                description=f"Job '{job.name}' completed in {duration_ms}ms",
                job_id=job_id,
                queue_id=queue_id,
                worker_id=worker_id,
            ))
        else:
            error_scenarios = [
                "Simulated execution failure: task raised an unexpected exception",
                "Connection timeout after 30s waiting for downstream service",
                "Out of memory error during payload processing",
                "Simulated rate limit exceeded: too many requests",
            ]
            error_msg = random.choice(error_scenarios)
            max_retries = job.max_retries if job.max_retries is not None else queue.max_retries

            execution.status = "failed"
            execution.completed_at = now
            execution.duration_ms = duration_ms
            execution.error_message = error_msg

            session.add(models.JobLog(
                job_id=job_id,
                execution_id=execution.id,
                level="error",
                message=f"Execution failed: {error_msg}",
                worker_id=worker_id,
            ))

            if job.retry_count < max_retries:
                job.retry_count += 1
                delay = calculate_retry_delay(queue.retry_strategy, job.retry_count, queue.retry_interval_seconds)
                job.status = "retry"
                job.scheduled_at = now + timedelta(seconds=delay)
                job.error_message = error_msg

                session.add(models.JobLog(
                    job_id=job_id,
                    level="warning",
                    message=f"Retry {job.retry_count}/{max_retries} scheduled in {delay}s",
                    worker_id=worker_id,
                ))
                session.add(models.ActivityEvent(
                    event_type="job_retried",
                    description=f"Job '{job.name}' failed, retry {job.retry_count}/{max_retries} scheduled",
                    job_id=job_id,
                    queue_id=queue_id,
                    worker_id=worker_id,
                ))
            else:
                job.status = "dead"
                job.error_message = error_msg
                job.ai_failure_summary = ai_failure_summary(error_msg)

                dlq_entry = models.DeadLetterQueue(
                    job_id=job_id,
                    job_name=job.name,
                    queue_id=queue_id,
                    queue_name=queue.name,
                    failure_reason=error_msg,
                    retry_count=job.retry_count,
                    payload=job.payload or {},
                )
                session.add(dlq_entry)
                session.add(models.ActivityEvent(
                    event_type="job_failed",
                    description=f"Job '{job.name}' exhausted all retries and moved to DLQ",
                    job_id=job_id,
                    queue_id=queue_id,
                    worker_id=worker_id,
                ))

        session.commit()

    except Exception as e:
        logger.exception(f"Worker execution error for job {job_id}: {e}")
        try:
            session.rollback()
        except Exception:
            pass
    finally:
        session.close()
        eng.dispose()


def claim_and_dispatch_jobs(session, worker_id: uuid.UUID, executor: ThreadPoolExecutor, db_url: str, active_futures: list):
    from backend.app import models

    # Clean up completed futures
    active_futures[:] = [f for f in active_futures if not f.done()]

    # Get all non-paused queues ordered by priority
    queues = (
        session.query(models.Queue)
        .filter(models.Queue.paused == False)
        .order_by(models.Queue.priority.desc())
        .all()
    )

    now = utcnow()

    for queue in queues:
        # Count currently running jobs for this queue
        running_in_queue = (
            session.query(models.Job)
            .filter(models.Job.queue_id == queue.id, models.Job.status == "running")
            .count()
        )
        available_slots = queue.concurrency - running_in_queue
        if available_slots <= 0:
            continue

        # Promote retry jobs whose scheduled_at has passed
        retry_jobs = (
            session.query(models.Job)
            .filter(
                models.Job.queue_id == queue.id,
                models.Job.status == "retry",
                models.Job.scheduled_at <= now,
            )
            .all()
        )
        for rj in retry_jobs:
            rj.status = "queued"
            rj.scheduled_at = None
        if retry_jobs:
            session.commit()

        # Promote scheduled jobs
        scheduled_jobs = (
            session.query(models.Job)
            .filter(
                models.Job.queue_id == queue.id,
                models.Job.status == "scheduled",
                models.Job.scheduled_at <= now,
                models.Job.cron_expression == None,  # noqa: E711
            )
            .all()
        )
        for sj in scheduled_jobs:
            sj.status = "queued"
        if scheduled_jobs:
            session.commit()

        # Claim jobs with FOR UPDATE SKIP LOCKED
        jobs_to_run = (
            session.query(models.Job)
            .filter(
                models.Job.queue_id == queue.id,
                models.Job.status == "queued",
            )
            .order_by(models.Job.priority.desc(), models.Job.created_at)
            .limit(available_slots)
            .with_for_update(skip_locked=True)
            .all()
        )

        for job in jobs_to_run:
            job.status = "running"
            job.worker_id = worker_id
            job.started_at = now
            session.flush()

        if jobs_to_run:
            session.commit()

        for job in jobs_to_run:
            future = executor.submit(simulate_job_execution, job.id, queue.id, worker_id, db_url)
            active_futures.append(future)
            logger.info(f"Dispatched job {job.id} ({job.name}) from queue {queue.name}")


def run_worker():
    """Entry point for the background worker thread."""
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        logger.error("DATABASE_URL not set — worker cannot start")
        return

    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()

    global WORKER_ID
    try:
        # Wait for DB to be ready
        time.sleep(2)
        WORKER_ID = register_worker(session)
    except Exception as e:
        logger.error(f"Failed to register worker: {e}")
        try:
            session.rollback()
        except Exception:
            pass
        return

    executor = ThreadPoolExecutor(max_workers=20, thread_name_prefix="job-exec")
    active_futures = []
    last_heartbeat = time.time()

    logger.info(f"Worker loop started (id={WORKER_ID})")

    while True:
        try:
            now = time.time()

            # Heartbeat
            if now - last_heartbeat >= HEARTBEAT_INTERVAL:
                send_heartbeat(session, WORKER_ID, len([f for f in active_futures if not f.done()]))
                last_heartbeat = now

            claim_and_dispatch_jobs(session, WORKER_ID, executor, db_url, active_futures)

        except Exception as e:
            logger.exception(f"Worker loop error: {e}")
            try:
                session.rollback()
            except Exception:
                pass
            time.sleep(5)
            continue

        time.sleep(POLL_INTERVAL)
