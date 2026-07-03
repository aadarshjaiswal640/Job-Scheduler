import uuid
from datetime import datetime, timezone
from typing import Optional, List, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..access import require_queue, require_job
from .. import models

router = APIRouter(prefix="/api", tags=["jobs"])


class JobInputReq(BaseModel):
    name: str
    job_type: str = "immediate"
    payload: Dict[str, Any] = {}
    priority: int = 5
    scheduled_at: Optional[str] = None
    cron_expression: Optional[str] = None
    max_retries: Optional[int] = None
    timeout_seconds: Optional[int] = None
    dependencies: Optional[List[str]] = None


class JobBatchReq(BaseModel):
    jobs: List[JobInputReq]


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


def _make_job(queue_id: str, body: JobInputReq, db: Session) -> models.Job:
    status = "queued"
    scheduled_at = None
    if body.scheduled_at:
        try:
            scheduled_at = datetime.fromisoformat(body.scheduled_at.replace("Z", "+00:00"))
            status = "scheduled"
        except ValueError:
            pass
    if body.job_type == "recurring" and body.cron_expression:
        status = "scheduled"

    queue = db.query(models.Queue).filter(models.Queue.id == queue_id).first()
    max_retries = body.max_retries if body.max_retries is not None else (queue.max_retries if queue else 3)

    return models.Job(
        name=body.name,
        queue_id=queue_id,
        job_type=body.job_type,
        status=status,
        payload=body.payload,
        priority=body.priority,
        max_retries=max_retries,
        scheduled_at=scheduled_at,
        cron_expression=body.cron_expression,
        timeout_seconds=body.timeout_seconds,
    )


@router.post("/queues/{queue_id}/jobs", status_code=201)
def create_job(queue_id: str, body: JobInputReq, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    queue = require_queue(queue_id, current_user, db)

    job = _make_job(queue_id, body, db)
    db.add(job)
    db.commit()
    db.refresh(job)

    db.add(models.ActivityEvent(
        event_type="job_queued",
        description=f"Job '{job.name}' added to queue '{queue.name}'",
        job_id=job.id,
        queue_id=queue.id,
    ))
    db.add(models.JobLog(job_id=job.id, level="info", message=f"Job created with type={job.job_type}, status={job.status}"))
    db.commit()

    return _job_to_dict(job, db)


@router.post("/queues/{queue_id}/jobs/batch", status_code=201)
def create_batch_jobs(queue_id: str, body: JobBatchReq, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    queue = require_queue(queue_id, current_user, db)

    jobs = [_make_job(queue_id, j, db) for j in body.jobs]
    for j in jobs:
        db.add(j)
    db.flush()

    for j in jobs:
        db.add(models.JobLog(job_id=j.id, level="info", message="Batch job created"))
    db.commit()
    for j in jobs:
        db.refresh(j)

    return [_job_to_dict(j, db) for j in jobs]


@router.get("/jobs")
def list_all_jobs(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    jobType: Optional[str] = Query(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Scope to queues in orgs the user belongs to
    org_ids = [
        m.org_id for m in
        db.query(models.OrganizationMember).filter(
            models.OrganizationMember.user_id == current_user.id
        ).all()
    ]
    project_ids = [
        p.id for p in
        db.query(models.Project).filter(models.Project.org_id.in_(org_ids)).all()
    ]
    queue_ids = [
        q.id for q in
        db.query(models.Queue).filter(models.Queue.project_id.in_(project_ids)).all()
    ]

    query = db.query(models.Job).filter(models.Job.queue_id.in_(queue_ids))

    if status:
        query = query.filter(models.Job.status == status)
    if jobType:
        query = query.filter(models.Job.job_type == jobType)
    if search:
        query = query.filter(models.Job.name.ilike(f"%{search}%"))

    total = query.count()
    jobs = query.order_by(models.Job.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "jobs": [_job_to_dict(j, db) for j in jobs],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": max(1, (total + limit - 1) // limit),
    }


@router.get("/jobs/{job_id}")
def get_job(job_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    job = require_job(job_id, current_user, db)
    return _job_to_dict(job, db)


@router.delete("/jobs/{job_id}", status_code=204)
def delete_job(job_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    job = require_job(job_id, current_user, db)
    db.delete(job)
    db.commit()


@router.post("/jobs/{job_id}/retry")
def retry_job(job_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    job = require_job(job_id, current_user, db)
    if job.status not in ("failed", "dead", "completed"):
        raise HTTPException(status_code=400, detail="Only failed, dead, or completed jobs can be retried")
    job.status = "queued"
    job.retry_count = 0
    job.error_message = None
    job.ai_failure_summary = None
    job.started_at = None
    job.completed_at = None
    db.add(models.JobLog(job_id=job.id, level="info", message="Job manually retried"))
    db.add(models.ActivityEvent(event_type="job_retried", description=f"Job '{job.name}' manually retried", job_id=job.id))
    db.commit()
    db.refresh(job)
    return _job_to_dict(job, db)


@router.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    job = require_job(job_id, current_user, db)
    if job.status in ("completed", "dead"):
        raise HTTPException(status_code=400, detail="Cannot cancel a completed or dead job")
    job.status = "failed"
    job.error_message = "Cancelled by user"
    job.completed_at = datetime.now(timezone.utc)
    db.add(models.JobLog(job_id=job.id, level="warning", message="Job cancelled by user"))
    db.commit()
    db.refresh(job)
    return _job_to_dict(job, db)


@router.get("/jobs/{job_id}/logs")
def get_job_logs(job_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    job = require_job(job_id, current_user, db)
    logs = db.query(models.JobLog).filter(models.JobLog.job_id == job.id).order_by(models.JobLog.timestamp).all()
    return [
        {
            "id": str(lg.id),
            "job_id": str(lg.job_id),
            "execution_id": str(lg.execution_id) if lg.execution_id else None,
            "level": lg.level,
            "message": lg.message,
            "worker_id": str(lg.worker_id) if lg.worker_id else None,
            "timestamp": lg.timestamp.isoformat(),
        }
        for lg in logs
    ]


@router.get("/jobs/{job_id}/executions")
def get_job_executions(job_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    job = require_job(job_id, current_user, db)
    execs = db.query(models.JobExecution).filter(models.JobExecution.job_id == job.id).order_by(models.JobExecution.started_at).all()
    return [
        {
            "id": str(e.id),
            "job_id": str(e.job_id),
            "attempt_number": e.attempt_number,
            "status": e.status,
            "worker_id": str(e.worker_id) if e.worker_id else None,
            "started_at": e.started_at.isoformat(),
            "completed_at": e.completed_at.isoformat() if e.completed_at else None,
            "duration_ms": e.duration_ms,
            "error_message": e.error_message,
            "output": e.output,
        }
        for e in execs
    ]
