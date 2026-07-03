"""
Centralized authorization helpers.

Every helper resolves the resource AND verifies the caller belongs
to the owning organization before returning.  Raise 403/404 on failure.
"""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from . import models


def _assert_org_member(user: models.User, org_id, db: Session) -> None:
    """Raise 403 unless the user is a member of the organization."""
    member = (
        db.query(models.OrganizationMember)
        .filter(
            models.OrganizationMember.org_id == org_id,
            models.OrganizationMember.user_id == user.id,
        )
        .first()
    )
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")


def require_project(project_id: str, user: models.User, db: Session) -> models.Project:
    """Return the project only if the caller is an org member."""
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _assert_org_member(user, project.org_id, db)
    return project


def require_queue(queue_id: str, user: models.User, db: Session) -> models.Queue:
    """Return the queue only if the caller is an org member."""
    queue = db.query(models.Queue).filter(models.Queue.id == queue_id).first()
    if not queue:
        raise HTTPException(status_code=404, detail="Queue not found")
    project = db.query(models.Project).filter(models.Project.id == queue.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    _assert_org_member(user, project.org_id, db)
    return queue


def require_job(job_id: str, user: models.User, db: Session) -> models.Job:
    """Return the job only if the caller is an org member."""
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    require_queue(str(job.queue_id), user, db)  # validates org membership
    return job


def require_dlq_entry(dlq_id: str, user: models.User, db: Session) -> models.DeadLetterQueue:
    """Return the DLQ entry only if the caller is an org member of the owning queue."""
    entry = db.query(models.DeadLetterQueue).filter(models.DeadLetterQueue.id == dlq_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="DLQ entry not found")
    require_queue(str(entry.queue_id), user, db)  # validates org membership
    return entry
