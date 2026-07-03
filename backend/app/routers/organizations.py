import re
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from .. import models

router = APIRouter(prefix="/api/organizations", tags=["organizations"])


class OrgInput(BaseModel):
    name: str
    description: Optional[str] = None


class OrgUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class MemberInviteReq(BaseModel):
    email: str
    role: str = "member"


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "org"


def _org_to_dict(org: models.Organization, db: Session) -> dict:
    member_count = db.query(models.OrganizationMember).filter(
        models.OrganizationMember.org_id == org.id
    ).count()
    project_count = db.query(models.Project).filter(models.Project.org_id == org.id).count()
    return {
        "id": str(org.id),
        "name": org.name,
        "slug": org.slug,
        "description": org.description,
        "owner_id": str(org.owner_id),
        "member_count": member_count,
        "project_count": project_count,
        "created_at": org.created_at.isoformat(),
    }


def _check_org_access(org_id: str, user: models.User, db: Session) -> models.Organization:
    org = db.query(models.Organization).filter(models.Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    member = db.query(models.OrganizationMember).filter(
        models.OrganizationMember.org_id == org_id,
        models.OrganizationMember.user_id == user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")
    return org


@router.get("")
def list_organizations(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    memberships = db.query(models.OrganizationMember).filter(
        models.OrganizationMember.user_id == current_user.id
    ).all()
    org_ids = [m.org_id for m in memberships]
    orgs = db.query(models.Organization).filter(models.Organization.id.in_(org_ids)).all()
    return [_org_to_dict(o, db) for o in orgs]


@router.post("", status_code=201)
def create_organization(body: OrgInput, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    slug_base = _slugify(body.name)
    slug = slug_base
    counter = 1
    while db.query(models.Organization).filter(models.Organization.slug == slug).first():
        slug = f"{slug_base}-{counter}"
        counter += 1

    org = models.Organization(name=body.name, slug=slug, description=body.description, owner_id=current_user.id)
    db.add(org)
    db.flush()
    member = models.OrganizationMember(org_id=org.id, user_id=current_user.id, role="admin")
    db.add(member)
    db.commit()
    db.refresh(org)
    return _org_to_dict(org, db)


@router.get("/{org_id}")
def get_organization(org_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = _check_org_access(org_id, current_user, db)
    return _org_to_dict(org, db)


@router.patch("/{org_id}")
def update_organization(org_id: str, body: OrgUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = _check_org_access(org_id, current_user, db)
    if body.name is not None:
        org.name = body.name
    if body.description is not None:
        org.description = body.description
    db.commit()
    db.refresh(org)
    return _org_to_dict(org, db)


@router.delete("/{org_id}", status_code=204)
def delete_organization(org_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = db.query(models.Organization).filter(
        models.Organization.id == org_id,
        models.Organization.owner_id == current_user.id,
    ).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found or access denied")
    db.delete(org)
    db.commit()


@router.get("/{org_id}/members")
def list_members(org_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_org_access(org_id, current_user, db)
    members = db.query(models.OrganizationMember).filter(
        models.OrganizationMember.org_id == org_id
    ).all()
    result = []
    for m in members:
        result.append({
            "id": str(m.id),
            "user_id": str(m.user_id),
            "email": m.user.email,
            "full_name": m.user.full_name,
            "role": m.role,
            "joined_at": m.joined_at.isoformat(),
        })
    return result


@router.post("/{org_id}/invite", status_code=201)
def invite_member(org_id: str, body: MemberInviteReq, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_org_access(org_id, current_user, db)

    user = db.query(models.User).filter(models.User.email == body.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User with that email not found")

    existing = db.query(models.OrganizationMember).filter(
        models.OrganizationMember.org_id == org_id,
        models.OrganizationMember.user_id == user.id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="User is already a member")

    member = models.OrganizationMember(org_id=org_id, user_id=user.id, role=body.role)
    db.add(member)
    db.commit()
    db.refresh(member)
    return {
        "id": str(member.id),
        "user_id": str(member.user_id),
        "email": user.email,
        "full_name": user.full_name,
        "role": member.role,
        "joined_at": member.joined_at.isoformat(),
    }


@router.delete("/{org_id}/members/{member_id}", status_code=204)
def remove_member(org_id: str, member_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_org_access(org_id, current_user, db)
    member = db.query(models.OrganizationMember).filter(
        models.OrganizationMember.id == member_id,
        models.OrganizationMember.org_id == org_id,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(member)
    db.commit()


@router.get("/{org_id}/projects")
def list_projects_in_org(org_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_org_access(org_id, current_user, db)
    projects = db.query(models.Project).filter(models.Project.org_id == org_id).all()
    return [_project_to_dict(p, db) for p in projects]


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
