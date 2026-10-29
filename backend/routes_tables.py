"""Tables, Sessions, and Split Billing routes for DapurOS."""
import uuid
from typing import List, Optional, Literal
from fastapi import APIRouter, Depends, HTTPException, Body, Header
from pydantic import BaseModel

from database import get_db, utcnow
from models import Table, TableCreate, TableUpdate, OrderSession, Order
from auth import get_current_user
from routes_orders import _calc
from restaurant_billing import settle_table, split_table, settle_split
from permissions import require_permission

router = APIRouter(prefix="/api/tables", tags=["tables"], dependencies=[Depends(require_permission("pos.use"))])


class SplitRequest(BaseModel):
    type: Literal["equal", "item"]
    ways: Optional[int] = 2
    # For split-by-item: list of items to pull out and pay
    items: Optional[List[dict]] = None # [{"product_id": str, "quantity": int}]


def _strip_id(d: dict) -> dict:
    if d:
        d.pop("_id", None)
    return d


async def notify_clients(store_id: str):
    # Trigger broadcast if WebSocket is active in server (we will import and call it)
    try:
        from server import ws_manager
        await ws_manager.broadcast(store_id, {"type": "TABLE_UPDATE"})
    except Exception:
        pass


@router.get("", response_model=List[Table])
async def list_tables(floor_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    db = get_db()
    flt = {"store_id": user["store_id"]}
    if floor_id:
        flt["floor_id"] = floor_id
        
    cursor = db.tables.find(flt, {"_id": 0}).sort("label", 1)
    return await cursor.to_list(length=200)


@router.post("", response_model=Table, dependencies=[Depends(require_permission('products.write'))])
async def create_table(payload: TableCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    from plan_limits import check_capacity
    await check_capacity(db, user["store_id"], user.get("plan"), "tables", "max_tables")
    existing = await db.tables.find_one({"store_id": user["store_id"], "floor_id": payload.floor_id, "label": payload.label})
    if existing:
        raise HTTPException(status_code=400, detail="Meja dengan label tersebut sudah ada di lantai ini")
    
    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "created_at": utcnow().isoformat(),
        "updated_at": utcnow().isoformat(),
        **payload.model_dump()
    }
    await db.tables.insert_one(doc)
    await notify_clients(user["store_id"])
    return _strip_id(doc)


@router.put("/{table_id}", response_model=Table, dependencies=[Depends(require_permission('products.write'))])
async def update_table(table_id: str, payload: TableUpdate, user: dict = Depends(get_current_user)):
    db = get_db()
    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Tidak ada perubahan data")
    
    update["updated_at"] = utcnow().isoformat()
    res = await db.tables.find_one_and_update(
        {"id": table_id, "store_id": user["store_id"]},
        {"$set": update},
        return_document=True,
        projection={"_id": 0}
    )
    if not res:
        raise HTTPException(status_code=404, detail="Meja tidak ditemukan")
    await notify_clients(user["store_id"])
    return res


@router.delete("/{table_id}", dependencies=[Depends(require_permission('products.write'))])
async def delete_table(table_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.tables.delete_one({"id": table_id, "store_id": user["store_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Meja tidak ditemukan")
    await notify_clients(user["store_id"])
    return {"ok": True}


# ---------- Dining Sessions ----------

@router.post("/{table_id}/session", response_model=OrderSession)
async def open_session(table_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    table = await db.tables.find_one({"id": table_id, "store_id": user["store_id"]})
    if not table:
        raise HTTPException(status_code=404, detail="Meja tidak ditemukan")
    
    # Check if there is an active session already
    active = await db.order_sessions.find_one({"table_id": table_id, "store_id": user["store_id"], "status": "Active"})
    if active:
        return _strip_id(active)
    
    session_id = str(uuid.uuid4())
    doc = {
        "id": session_id,
        "table_id": table_id,
        "store_id": user["store_id"],
        "opened_at": utcnow().isoformat(),
        "closed_at": None,
        "status": "Active"
    }
    await db.order_sessions.insert_one(doc)
    
    # Update table status to Seated
    await db.tables.update_one(
        {"id": table_id, "store_id": user["store_id"]},
        {"$set": {"status": "Seated", "updated_at": utcnow().isoformat()}}
    )
    await notify_clients(user["store_id"])
    return _strip_id(doc)


@router.get("/{table_id}/session")
async def get_active_session_bill(table_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    session = await db.order_sessions.find_one({"table_id": table_id, "store_id": user["store_id"], "status": "Active"})
    if not session:
        raise HTTPException(status_code=404, detail="Tidak ada sesi aktif di meja ini")
    
    # Find all orders in this session
    orders = await db.orders.find({"session_id": session["id"], "store_id": user["store_id"], "payment_status": "pending"}, {"_id": 0}).to_list(length=100)
    
    subtotal = 0
    discount = 0
    items_summary = []
    
    for o in orders:
        subtotal += o.get("subtotal", 0)
        discount += o.get("discount", 0)
        items_summary.extend(o.get("items", []))
        
    # Recalculate F&B service charge (5%) and tax_pb1 (10% applied on subtotal + service)
    base_amount = max(0, subtotal - discount)
    service_charge = round(base_amount * 0.05, 2)
    tax_pb1 = round((base_amount + service_charge) * 0.10, 2)
    grand_total = base_amount + service_charge + tax_pb1
    
    return {
        "session": _strip_id(session),
        "orders": orders,
        "items": items_summary,
        "subtotal": subtotal,
        "discount": discount,
        "service_charge": service_charge,
        "tax_pb1": tax_pb1,
        "grand_total": grand_total
    }


@router.post('/{table_id}/checkout')
async def settle_session(table_id: str, payment_method: str = Body(..., embed=True), cash_received: Optional[float] = Body(None, embed=True), expected_session_id: Optional[str] = Body(None, embed=True), checked_in_bank: bool = Body(False, embed=True), received_amount: Optional[float] = Body(None, embed=True), user: dict = Depends(get_current_user)):
    result = await settle_table(get_db(), user, table_id, payment_method, expected=expected_session_id, cash=cash_received, checked=checked_in_bank, amount=received_amount)
    await notify_clients(user['store_id'])
    return result


@router.post('/{table_id}/split-bill')
async def split_bill(table_id: str, req: SplitRequest, user: dict = Depends(get_current_user), idempotency_key: Optional[str] = Header(None, alias='Idempotency-Key')):
    result = await split_table(get_db(), user, table_id, req.model_dump(), idempotency_key)
    await notify_clients(user['store_id'])
    return result


@router.post('/{table_id}/split-orders/{order_id}/settle')
async def settle_split_order(table_id: str, order_id: str, payment_method: str = Body(..., embed=True), user: dict = Depends(get_current_user)):
    return await settle_split(get_db(), user, table_id, order_id, payment_method)
