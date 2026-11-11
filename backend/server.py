"""Geraina POS by DagangOS - FastAPI server."""
import os
import logging
import asyncio
from pathlib import Path
from dotenv import load_dotenv

import sys
ROOT_DIR = Path(__file__).parent
sys.path.append(str(ROOT_DIR))
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI, APIRouter, Response
from fastapi.middleware.cors import CORSMiddleware

from database import close_db, get_db
from erasure_guard import ErasureContextMiddleware, capabilities
from routes_auth import router as auth_router
from routes_products import router as products_router
from routes_orders import router as orders_router
from routes_webhooks import router as webhooks_router
from routes_pdf import router as pdf_router
from routes_pricing import router as pricing_router
from routes_subscriptions import router as subscriptions_router
from routes_inventory import router as inventory_router
from routes_purchase import router as purchase_router
from routes_customers import router as customers_router
from routes_staff import router as staff_router
from routes_settings import router as settings_router
from routes_ingredients import router as ingredients_router
from routes_floors import router as floors_router
from routes_tables import router as tables_router
from routes_kds import router as kds_router
from routes_reports import router as reports_router
from routes_printer import router as printer_router
from routes_edc import router as edc_router
from routes_devices import router as devices_router
from routes_records import router as records_router
from routes_offline import router as offline_router
from routes_support import router as support_router
from routes_guest import router as guest_router, staff_router as table_qr_router
from routes_stock import router as stock_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("geraina")

app = FastAPI(title="DapurOS by DagangOS")
app.include_router(stock_router)
app.add_middleware(ErasureContextMiddleware, default_module="dapuros")

@app.middleware('http')
async def public_menu_headers(request, call_next):
    response=await call_next(request)
    if request.url.path.startswith('/api/public/qr/'):
        response.headers['Cache-Control']='no-store'
        response.headers['Referrer-Policy']='no-referrer'
        response.headers['X-Content-Type-Options']='nosniff'
    return response


# ---------- WebSockets Connection Manager ----------
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, List

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, store_id: str, websocket: WebSocket):
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
            for connection in list(self.active_connections.get(store_id,[])):
                try:
                    await connection.send_json(message)
                except Exception:
                    self.disconnect(store_id,connection)

ws_manager = ConnectionManager()


@app.websocket("/api/ws/{store_id}")
async def websocket_endpoint(websocket: WebSocket, store_id: str):
    from auth import get_current_user
    from fastapi import HTTPException
    await websocket.accept()
    try:
        message = await asyncio.wait_for(websocket.receive_json(), timeout=5)
        token = message.get('token') if isinstance(message, dict) and message.get('type') == 'AUTH' else None
        if not isinstance(token, str) or len(token) > 8192:
            raise HTTPException(401)
        async def validate():
            from permissions import has_permission
            user = await get_current_user(token, 'dapuros', request=None)
            if user.get('store_id') != store_id or not has_permission(user, 'pos.use'):
                raise HTTPException(403)
        await validate()
        await ws_manager.connect(store_id, websocket)
        await websocket.send_json({'type':'AUTH_OK'})
        while True:
            await asyncio.wait_for(websocket.receive_text(), timeout=35)
            await validate()
            await websocket.send_json({"type": "PONG"})
    except WebSocketDisconnect:
        pass
    except (HTTPException, asyncio.TimeoutError, ValueError, TypeError):
        try:
            await websocket.close(code=1008)
        except RuntimeError:
            pass
    finally:
        ws_manager.disconnect(store_id, websocket)


# Health check (mounted at /api by frontend, but also at root for k8s)
api_router = APIRouter(prefix="/api")


@api_router.get("/system/erasure-capabilities")
async def erasure_capabilities(response: Response):
    response.headers["Cache-Control"] = "no-store"
    return capabilities("dapuros", get_db())


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
        return {"ok": True,'revision':os.environ.get('VERCEL_GIT_COMMIT_SHA')}
    except Exception as e:
        return {"ok": False, "error": str(e)}


app.include_router(api_router)
app.include_router(auth_router)
app.include_router(products_router)
app.include_router(orders_router)
app.include_router(webhooks_router)
app.include_router(pdf_router)
app.include_router(pricing_router)
app.include_router(subscriptions_router)
app.include_router(inventory_router)
app.include_router(purchase_router)
app.include_router(customers_router)
app.include_router(staff_router)
app.include_router(settings_router)
app.include_router(ingredients_router)
app.include_router(floors_router)
app.include_router(tables_router)
app.include_router(kds_router)
app.include_router(reports_router)
app.include_router(printer_router)
app.include_router(edc_router)
app.include_router(devices_router)

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


@app.on_event("startup")
async def _ensure_indexes():
    """Index idempotent — resolusi toko per-request (stores by owner+module) tetap cepat."""
    db = get_db()
    for coll, keys in (
        ("stores", [("owner_user_id", 1), ("module", 1)]),
        ("users", [("email", 1)]),
        ("orders", [("store_id", 1), ("created_at", -1)]),
        ("products", [("store_id", 1)]),
        ("table_bookings", [("store_id", 1), ("start_at", 1), ("end_at", 1)]),
        ("table_bookings", [("store_id", 1), ("table_id", 1), ("status", 1), ("end_at", 1)]),
    ):
        try:
            await db[coll].create_index(keys)
        except Exception as e:
            logger.warning(f"ensure index {coll} failed: {e}")
    for coll, key, options in (
        ('tables','qr_token_hash',{'sparse':True}),
        ('checkout_attempts','guest_expires_at',{'expireAfterSeconds':0}),
        ('checkout_attempts','gateway_reference',{'sparse':True}),
        ('checkout_attempts','xendit_reference_id',{'sparse':True}),
        ('checkout_attempts','doku_id',{'sparse':True}),
        ('capacity_guards','guest_rate_expires_at',{'expireAfterSeconds':0}),
    ):
        try:
            await db[coll].create_index(key, **options)
        except Exception as error:
            logger.warning('ensure guest index %s failed: %s',coll,error)


@app.on_event("shutdown")
async def _shutdown():
    close_db()

app.include_router(offline_router)
app.include_router(support_router)
app.include_router(guest_router)
app.include_router(table_qr_router)

app.include_router(records_router)
