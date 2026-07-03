from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..deps import get_current_user
from .. import models

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_stats(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    status_counts = dict(
        db.query(models.Job.status, func.count(models.Job.id))
        .group_by(models.Job.status)
        .all()
    )
    total_jobs = sum(status_counts.values())
    completed = status_counts.get("completed", 0)
    failed = status_counts.get("failed", 0)
    running = status_counts.get("running", 0)
    queued = status_counts.get("queued", 0)
    scheduled = status_counts.get("scheduled", 0)
    dead = status_counts.get("dead", 0)

    success_rate = round(completed / max(1, completed + failed) * 100, 2)

    active_workers = db.query(models.Worker).filter(models.Worker.status.in_(["active", "idle"])).count()
    total_queues = db.query(models.Queue).count()
    dlq_count = db.query(models.DeadLetterQueue).count()

    completed_execs = (
        db.query(func.avg(models.JobExecution.duration_ms))
        .filter(models.JobExecution.status == "completed")
        .scalar()
    )
    avg_ms = round(float(completed_execs or 0), 2)

    recent_completed = (
        db.query(models.Job)
        .filter(
            models.Job.status == "completed",
            models.Job.completed_at >= datetime.now(timezone.utc) - timedelta(minutes=60),
        )
        .count()
    )
    throughput = round(recent_completed / 60, 4)

    return {
        "total_jobs": total_jobs,
        "running_jobs": running,
        "completed_jobs": completed,
        "failed_jobs": failed,
        "queued_jobs": queued,
        "scheduled_jobs": scheduled,
        "active_workers": active_workers,
        "total_queues": total_queues,
        "dlq_count": dlq_count,
        "success_rate": success_rate,
        "avg_execution_ms": avg_ms,
        "throughput_per_minute": throughput,
    }


@router.get("/metrics")
def get_metrics(
    period: Optional[str] = Query("24h"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    period_map = {"1h": 1, "6h": 6, "24h": 24, "7d": 168, "30d": 720}
    hours = period_map.get(period, 24)
    bucket_count = min(hours, 24)
    bucket_hours = hours / bucket_count

    now = datetime.now(timezone.utc)
    result = []

    for i in range(bucket_count - 1, -1, -1):
        bucket_end = now - timedelta(hours=i * bucket_hours)
        bucket_start = bucket_end - timedelta(hours=bucket_hours)

        completed = (
            db.query(func.count(models.Job.id))
            .filter(
                models.Job.status == "completed",
                models.Job.completed_at >= bucket_start,
                models.Job.completed_at < bucket_end,
            )
            .scalar()
            or 0
        )
        failed = (
            db.query(func.count(models.Job.id))
            .filter(
                models.Job.status == "failed",
                models.Job.completed_at >= bucket_start,
                models.Job.completed_at < bucket_end,
            )
            .scalar()
            or 0
        )
        avg_dur = (
            db.query(func.avg(models.JobExecution.duration_ms))
            .filter(
                models.JobExecution.status == "completed",
                models.JobExecution.completed_at >= bucket_start,
                models.JobExecution.completed_at < bucket_end,
            )
            .scalar()
        )

        result.append({
            "timestamp": bucket_end.isoformat(),
            "completed": completed,
            "failed": failed,
            "throughput": round(completed / max(1, bucket_hours * 60), 4),
            "avg_duration_ms": round(float(avg_dur or 0), 2),
        })

    return result


@router.get("/activity")
def get_activity(
    limit: int = Query(20, ge=1, le=100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    events = (
        db.query(models.ActivityEvent)
        .order_by(models.ActivityEvent.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": str(e.id),
            "event_type": e.event_type,
            "description": e.description,
            "job_id": str(e.job_id) if e.job_id else None,
            "queue_id": str(e.queue_id) if e.queue_id else None,
            "worker_id": str(e.worker_id) if e.worker_id else None,
            "timestamp": e.timestamp.isoformat(),
        }
        for e in events
    ]


@router.get("/queue-summary")
def get_queue_summary(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    queues = db.query(models.Queue).all()
    result = []
    for q in queues:
        status_counts = dict(
            db.query(models.Job.status, func.count(models.Job.id))
            .filter(models.Job.queue_id == q.id)
            .group_by(models.Job.status)
            .all()
        )
        project = db.query(models.Project).filter(models.Project.id == q.project_id).first()
        completed = status_counts.get("completed", 0)
        result.append({
            "queue_id": str(q.id),
            "queue_name": q.name,
            "project_name": project.name if project else "",
            "queued": status_counts.get("queued", 0),
            "running": status_counts.get("running", 0),
            "completed": completed,
            "failed": status_counts.get("failed", 0),
            "paused": q.paused,
            "throughput_per_minute": round(completed / max(1, 60), 4),
        })
    return result
