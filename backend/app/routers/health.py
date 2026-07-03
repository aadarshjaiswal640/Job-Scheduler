from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..database import get_db
from .. import models

router = APIRouter()


@router.get("/api/healthz")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception:
        db_status = "unhealthy"

    worker_count = db.query(models.Worker).filter(models.Worker.status == "active").count()

    return {"status": "ok", "database": db_status, "worker_count": worker_count}
