"""Geraina POS by DagangOS - FastAPI server."""
import os
import logging
from pathlib import Path
from dotenv import load_dotenv

import sys
ROOT_DIR = Path(__file__).parent
sys.path.append(str(ROOT_DIR))
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware

from database import close_db, get_db
from routes_auth import router as auth_router
from routes_products import router as products_router
from routes_orders import router as orders_router
from routes_webhooks import router as webhooks_router
from routes_pdf import router as pdf_router
from routes_pricing import router as pricing_router
from routes_inventory import router as inventory_router
from routes_purchase import router as purchase_router
from routes_customers import router as customers_router
from routes_staff import router as staff_router
from routes_settings import router as settings_router
from routes_ingredients import router as ingredients_router
from routes_floors import router as floors_router
from routes_tables import router as tables_router
from routes_kds import router as kds_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("geraina")

app = FastAPI(title="DapurOS by DagangOS")


# ---------- WebSockets Connection Manager ----------
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, List

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, store_id: str, websocket: WebSocket):
        await websocket.accept()
        if store_id not in self.active_connections:
            self.active_connections[store_id] = []
        self.active_connections[store_id].append(websocket)

    def disconnect(self, store_id: str, websocket: WebSocket):
        if store_id in self.active_connections:
            try:
                self.active_connections[store_id].remove(websocket)
            except ValueError:
                pass
            if not self.active_connections[store_id]:
                del self.active_connections[store_id]

    async def broadcast(self, store_id: str, message: dict):
        if store_id in self.active_connections:
            for connection in self.active_connections[store_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

ws_manager = ConnectionManager()


@app.websocket("/api/ws/{store_id}")
async def websocket_endpoint(websocket: WebSocket, store_id: str):
    await ws_manager.connect(store_id, websocket)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
            await websocket.send_json({"type": "PONG"})
    except WebSocketDisconnect:
        ws_manager.disconnect(store_id, websocket)


# Health check (mounted at /api by frontend, but also at root for k8s)
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {
        "service": "DapurOS by DagangOS",
        "status": "ok",
        "version": "1.0.0",
    }


@api_router.get("/health")
async def health():
    try:
        db = get_db()
        await db.command("ping")
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


app.include_router(api_router)
app.include_router(auth_router)
app.include_router(products_router)
app.include_router(orders_router)
app.include_router(webhooks_router)
app.include_router(pdf_router)
app.include_router(pricing_router)
app.include_router(inventory_router)
app.include_router(purchase_router)
app.include_router(customers_router)
app.include_router(staff_router)
app.include_router(settings_router)
app.include_router(ingredients_router)
app.include_router(floors_router)
app.include_router(tables_router)
app.include_router(kds_router)

cors_origins = os.environ.get("CORS_ORIGINS", "").split(",")
cors_origins = [o.strip() for o in cors_origins if o.strip()]
cors_origin_regex = r"https://.*\.pages\.dev|http://localhost(:\d+)?|https://(.*\.)?dagangos\.com"

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins or ["http://localhost:3000"],
    allow_origin_regex=cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def _shutdown():
    close_db()
