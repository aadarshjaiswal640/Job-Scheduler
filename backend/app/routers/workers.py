from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from .. import models

router = APIRouter(prefix="/api/workers", tags=["workers"])


def _worker_to_dict(w: models.Worker) -> dict:
    return {
        "id": str(w.id),
        "hostname": w.hostname,
        "status": w.status,
        "running_jobs": w.running_jobs,
        "completed_jobs": w.completed_jobs,
        "failed_jobs": w.failed_jobs,
        "current_queue": w.current_queue,
        "cpu_usage": w.cpu_usage,
        "memory_usage": w.memory_usage,
        "last_heartbeat": w.last_heartbeat.isoformat(),
        "created_at": w.created_at.isoformat(),
    }


@router.get("")
def list_workers(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    workers = db.query(models.Worker).order_by(models.Worker.last_heartbeat.desc()).all()
    return [_worker_to_dict(w) for w in workers]


@router.get("/{worker_id}")
def get_worker(worker_id: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    worker = db.query(models.Worker).filter(models.Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    return _worker_to_dict(worker)
