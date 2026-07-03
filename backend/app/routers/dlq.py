from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..access import require_dlq_entry
from .. import models
from .jobs import _job_to_dict

router = APIRouter(prefix="/api/dlq", tags=["dlq"])


def _dlq_to_dict(d: models.DeadLetterQueue) -> dict:
    return {
        "id": str(d.id),
        "job_id": str(d.job_id),
        "job_name": d.job_name,
        "queue_id": str(d.queue_id),
        "queue_name": d.queue_name,
        "failure_reason": d.failure_reason,
        "retry_count": d.retry_count,
        "payload": d.payload or {},
        "moved_at": d.moved_at.isoformat(),
    }


def _user_queue_ids(user, db: Session):
    """Return queue IDs accessible to the given user."""
    org_ids = [
        m.org_id for m in
        db.query(models.OrganizationMember)
        .filter(models.OrganizationMember.user_id == user.id)
        .all()
    ]
    project_ids = [
        p.id for p in
        db.query(models.Project).filter(models.Project.org_id.in_(org_ids)).all()
    ]
    return [
        q.id for q in
        db.query(models.Queue).filter(models.Queue.project_id.in_(project_ids)).all()
    ]


@router.get("")
def list_dlq(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    accessible = _user_queue_ids(current_user, db)
    query = db.query(models.DeadLetterQueue).filter(
        models.DeadLetterQueue.queue_id.in_(accessible)
    )
    total = query.count()
    entries = (
        query.order_by(models.DeadLetterQueue.moved_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {
        "entries": [_dlq_to_dict(e) for e in entries],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": max(1, (total + limit - 1) // limit),
    }


@router.get("/{dlq_id}")
def get_dlq_entry(dlq_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    entry = require_dlq_entry(dlq_id, current_user, db)
    return _dlq_to_dict(entry)


@router.post("/{dlq_id}/retry")
def retry_dlq_entry(dlq_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    entry = require_dlq_entry(dlq_id, current_user, db)

    job = models.Job(
        name=entry.job_name,
        queue_id=entry.queue_id,
        job_type="immediate",
        status="queued",
        payload=entry.payload,
        retry_count=0,
    )
    db.add(job)
    db.flush()
    db.add(models.JobLog(job_id=job.id, level="info", message=f"Re-queued from DLQ entry {dlq_id}"))
    db.delete(entry)
    db.commit()
    db.refresh(job)
    return _job_to_dict(job, db)


@router.post("/{dlq_id}/restore")
def restore_dlq_entry(dlq_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    entry = require_dlq_entry(dlq_id, current_user, db)

    original_job = db.query(models.Job).filter(models.Job.id == entry.job_id).first()
    if original_job:
        original_job.status = "queued"
        original_job.retry_count = 0
        original_job.error_message = None
        original_job.ai_failure_summary = None
        db.add(models.JobLog(job_id=original_job.id, level="info", message="Restored from DLQ"))
        db.delete(entry)
        db.commit()
        db.refresh(original_job)
        return _job_to_dict(original_job, db)

    job = models.Job(
        id=entry.job_id,
        name=entry.job_name,
        queue_id=entry.queue_id,
        job_type="immediate",
        status="queued",
        payload=entry.payload,
        retry_count=0,
    )
    db.add(job)
    db.flush()
    db.add(models.JobLog(job_id=job.id, level="info", message=f"Restored from DLQ {dlq_id}"))
    db.delete(entry)
    db.commit()
    db.refresh(job)
    return _job_to_dict(job, db)


@router.delete("/{dlq_id}", status_code=204)
def delete_dlq_entry(dlq_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    entry = require_dlq_entry(dlq_id, current_user, db)
    db.delete(entry)
    db.commit()
