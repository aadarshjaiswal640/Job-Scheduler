import asyncio
import json
from typing import Set

from fastapi import WebSocket


class WebSocketManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast(self, message: dict):
        if not self.active_connections:
            return
        data = json.dumps(message, default=str)
        dead = set()
        for connection in self.active_connections:
            try:
                await connection.send_text(data)
            except Exception:
                dead.add(connection)
        for conn in dead:
            self.active_connections.discard(conn)

    async def broadcast_event(self, event_type: str, data: dict):
        await self.broadcast({"type": event_type, "data": data})


ws_manager = WebSocketManager()
