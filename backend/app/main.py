import logging
import sys
import os

from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .websocket import ws_manager
from .routers import health, auth, organizations, projects, queues, jobs, workers, dashboard, dlq

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created/verified")
    except Exception as e:
        logger.error(f"Database setup failed: {e}")

    # Start the background worker in a daemon thread
    import threading
    # Ensure workspace root is on sys.path so 'worker' module is importable
    workspace = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    if workspace not in sys.path:
        sys.path.insert(0, workspace)

    from worker.main import run_worker
    worker_thread = threading.Thread(target=run_worker, daemon=True, name="job-worker")
    worker_thread.start()
    logger.info("Background worker started")

    yield

    logger.info("Shutting down")


app = FastAPI(
    title="Job Scheduler API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(organizations.router)
app.include_router(projects.router)
app.include_router(queues.router)
app.include_router(jobs.router)
app.include_router(workers.router)
app.include_router(dashboard.router)
app.include_router(dlq.router)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
