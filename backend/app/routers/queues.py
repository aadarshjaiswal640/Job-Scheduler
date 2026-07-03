from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..access import require_queue, require_project
from .. import models

router = APIRouter(prefix="/api", tags=["queues"])


class RetryPolicyModel(BaseModel):
    strategy: str = "exponential"
    max_retries: int = 3
    retry_interval_seconds: int = 60


class QueueInput(BaseModel):
    name: str
    description: Optional[str] = None
    priority: int = 5
    concurrency: int = 5
    retry_policy: RetryPolicyModel


class QueueUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[int] = None
    concurrency: Optional[int] = None
    retry_policy: Optional[RetryPolicyModel] = None


def _job_counts(queue_id, db: Session) -> dict:
    from sqlalchemy import func
    rows = (
        db.query(models.Job.status, func.count(models.Job.id))
        .filter(models.Job.queue_id == queue_id)
        .group_by(models.Job.status)
        .all()
    )
    counts = {r[0]: r[1] for r in rows}
    return {
        "queued": counts.get("queued", 0),
        "running": counts.get("running", 0),
        "completed": counts.get("completed", 0),
        "failed": counts.get("failed", 0),
        "scheduled": counts.get("scheduled", 0),
        "dead": counts.get("dead", 0),
    }


def _queue_to_dict(q: models.Queue, db: Session) -> dict:
    return {
        "id": str(q.id),
        "name": q.name,
        "description": q.description,
        "project_id": str(q.project_id),
        "priority": q.priority,
        "concurrency": q.concurrency,
        "paused": q.paused,
        "retry_policy": {
            "strategy": q.retry_strategy,
            "max_retries": q.max_retries,
            "retry_interval_seconds": q.retry_interval_seconds,
        },
        "job_counts": _job_counts(q.id, db),
        "created_at": q.created_at.isoformat(),
    }


@router.get("/projects/{project_id}/queues")
def list_queues(project_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_project(project_id, current_user, db)
    queues = db.query(models.Queue).filter(models.Queue.project_id == project_id).all()
    return [_queue_to_dict(q, db) for q in queues]


@router.post("/projects/{project_id}/queues", status_code=201)
def create_queue(project_id: str, body: QueueInput, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_project(project_id, current_user, db)
    queue = models.Queue(
        name=body.name,
        description=body.description,
        project_id=project_id,
        priority=body.priority,
        concurrency=body.concurrency,
        retry_strategy=body.retry_policy.strategy,
        max_retries=body.retry_policy.max_retries,
        retry_interval_seconds=body.retry_policy.retry_interval_seconds,
    )
    db.add(queue)
    db.commit()
    db.refresh(queue)
    return _queue_to_dict(queue, db)


@router.get("/queues/{queue_id}")
def get_queue(queue_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    queue = require_queue(queue_id, current_user, db)
    return _queue_to_dict(queue, db)


@router.patch("/queues/{queue_id}")
def update_queue(queue_id: str, body: QueueUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    queue = require_queue(queue_id, current_user, db)
    if body.name is not None:
        queue.name = body.name
    if body.description is not None:
        queue.description = body.description
    if body.priority is not None:
        queue.priority = body.priority
    if body.concurrency is not None:
        queue.concurrency = body.concurrency
    if body.retry_policy is not None:
        queue.retry_strategy = body.retry_policy.strategy
        queue.max_retries = body.retry_policy.max_retries
        queue.retry_interval_seconds = body.retry_policy.retry_interval_seconds
    db.commit()
    db.refresh(queue)
    return _queue_to_dict(queue, db)


@router.delete("/queues/{queue_id}", status_code=204)
def delete_queue(queue_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    queue = require_queue(queue_id, current_user, db)
    db.delete(queue)
    db.commit()


@router.post("/queues/{queue_id}/pause")
def pause_queue(queue_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    queue = require_queue(queue_id, current_user, db)
    queue.paused = True
    db.commit()
    db.refresh(queue)
    return _queue_to_dict(queue, db)


@router.post("/queues/{queue_id}/resume")
def resume_queue(queue_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    queue = require_queue(queue_id, current_user, db)
    queue.paused = False
    db.commit()
    db.refresh(queue)
    return _queue_to_dict(queue, db)


@router.get("/queues/{queue_id}/metrics")
def get_queue_metrics(queue_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    queue = require_queue(queue_id, current_user, db)
    counts = _job_counts(queue.id, db)

    completed_executions = (
        db.query(models.JobExecution)
        .join(models.Job, models.JobExecution.job_id == models.Job.id)
        .filter(
            models.Job.queue_id == queue.id,
            models.JobExecution.status == "completed",
            models.JobExecution.duration_ms.isnot(None),
        )
        .all()
    )
    avg_ms = 0.0
    if completed_executions:
        avg_ms = sum(e.duration_ms for e in completed_executions) / len(completed_executions)

    total_retries = (
        db.query(models.Job)
        .filter(models.Job.queue_id == queue.id, models.Job.retry_count > 0)
        .count()
    )
    dlq_count = db.query(models.DeadLetterQueue).filter(
        models.DeadLetterQueue.queue_id == queue.id
    ).count()

    return {
        "queue_id": str(queue.id),
        "job_counts": counts,
        "throughput_per_minute": round(counts["completed"] / max(1, 60), 4),
        "avg_execution_ms": round(avg_ms, 2),
        "retry_count": total_retries,
        "dlq_count": dlq_count,
        "recent_metrics": [],
    }


@router.get("/queues/{queue_id}/jobs")
def list_jobs_in_queue(queue_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    queue = require_queue(queue_id, current_user, db)
    jobs = (
        db.query(models.Job)
        .filter(models.Job.queue_id == queue.id)
        .order_by(models.Job.created_at.desc())
        .limit(100)
        .all()
    )
    return {
        "jobs": [_job_to_dict(j, db) for j in jobs],
        "total": len(jobs),
        "page": 1,
        "limit": 100,
        "pages": 1,
    }


def _job_to_dict(j: models.Job, db: Session) -> dict:
    queue = db.query(models.Queue).filter(models.Queue.id == j.queue_id).first()
    return {
        "id": str(j.id),
        "name": j.name,
        "queue_id": str(j.queue_id),
        "queue_name": queue.name if queue else None,
        "job_type": j.job_type,
        "status": j.status,
        "payload": j.payload or {},
        "priority": j.priority,
        "retry_count": j.retry_count,
        "max_retries": j.max_retries,
        "scheduled_at": j.scheduled_at.isoformat() if j.scheduled_at else None,
        "cron_expression": j.cron_expression,
        "started_at": j.started_at.isoformat() if j.started_at else None,
        "completed_at": j.completed_at.isoformat() if j.completed_at else None,
        "worker_id": str(j.worker_id) if j.worker_id else None,
        "error_message": j.error_message,
        "ai_failure_summary": j.ai_failure_summary,
        "timeout_seconds": j.timeout_seconds,
        "created_at": j.created_at.isoformat(),
    }
