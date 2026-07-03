import re
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..access import require_project, _assert_org_member
from .. import models

router = APIRouter(prefix="/api", tags=["projects"])


class ProjectInput(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "project"


def _project_to_dict(p: models.Project, db: Session) -> dict:
    queue_count = db.query(models.Queue).filter(models.Queue.project_id == p.id).count()
    job_count = (
        db.query(models.Job)
        .join(models.Queue, models.Job.queue_id == models.Queue.id)
        .filter(models.Queue.project_id == p.id)
        .count()
    )
    return {
        "id": str(p.id),
        "name": p.name,
        "slug": p.slug,
        "description": p.description,
        "org_id": str(p.org_id),
        "queue_count": queue_count,
        "job_count": job_count,
        "created_at": p.created_at.isoformat(),
    }


def _check_org_access(org_id: str, user: models.User, db: Session) -> models.Organization:
    org = db.query(models.Organization).filter(models.Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    _assert_org_member(user, org.id, db)
    return org


@router.get("/organizations/{org_id}/projects")
def list_projects(org_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_org_access(org_id, current_user, db)
    projects = db.query(models.Project).filter(models.Project.org_id == org_id).all()
    return [_project_to_dict(p, db) for p in projects]


@router.post("/organizations/{org_id}/projects", status_code=201)
def create_project(org_id: str, body: ProjectInput, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_org_access(org_id, current_user, db)
    slug = _slugify(body.name)
    project = models.Project(name=body.name, slug=slug, description=body.description, org_id=org_id)
    db.add(project)
    db.commit()
    db.refresh(project)
    return _project_to_dict(project, db)


@router.get("/projects/{project_id}")
def get_project(project_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = require_project(project_id, current_user, db)
    return _project_to_dict(project, db)


@router.patch("/projects/{project_id}")
def update_project(project_id: str, body: ProjectUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = require_project(project_id, current_user, db)
    if body.name is not None:
        project.name = body.name
    if body.description is not None:
        project.description = body.description
    db.commit()
    db.refresh(project)
    return _project_to_dict(project, db)


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = require_project(project_id, current_user, db)
    db.delete(project)
    db.commit()
