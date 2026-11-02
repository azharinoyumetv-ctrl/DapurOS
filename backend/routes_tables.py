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
from restaurant_billing import close_empty
from decimal import Decimal
from permissions import require_permission
import transactions
from table_safety import ensure_idle

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
    async def create(session):
        if not await db.floors.find_one({'store_id':user['store_id'],'id':payload.floor_id},session=session):
            raise HTTPException(422,'Lantai tidak ditemukan di restoran ini.')
        await db.capacity_guards.update_one({'_id':user['store_id']+':tables'},{'$inc':{'revision':1}},upsert=True,session=session)
        await check_capacity(db, user['store_id'], user.get('plan'), 'tables', 'max_tables')
        if await db.tables.find_one({'store_id':user['store_id'],'floor_id':payload.floor_id,'label':payload.label},session=session):
            raise HTTPException(409,'Meja dengan label tersebut sudah ada di lantai ini.')
        doc={'id':str(uuid.uuid4()),'store_id':user['store_id'],'created_at':utcnow().isoformat(),'updated_at':utcnow().isoformat(),**payload.model_dump()}
        await db.tables.insert_one(dict(doc),session=session)
        return doc
    doc=await transactions.run_transaction(db,create)
    await notify_clients(user["store_id"])
    return _strip_id(doc)


@router.put("/{table_id}", response_model=Table, dependencies=[Depends(require_permission('products.write'))])
async def update_table(table_id: str, payload: TableUpdate, user: dict = Depends(get_current_user)):
    db = get_db()
    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Tidak ada perubahan data")
    
    update["updated_at"] = utcnow().isoformat()
    async def save(session):
        scope={'id':table_id,'store_id':user['store_id']}
        if not await db.tables.find_one(scope,session=session):raise HTTPException(404,'Meja tidak ditemukan.')
        if update.get('status')=='Vacant':await ensure_idle(db,user['store_id'],[table_id],session)
        if update.get('floor_id') and not await db.floors.find_one({'id':update['floor_id'],'store_id':user['store_id']},session=session):raise HTTPException(422,'Lantai tidak ditemukan di restoran ini.')
        return await db.tables.find_one_and_update(scope,{'$set':update},return_document=True,projection={'_id':0},session=session)
    res=await transactions.run_transaction(db,save)
    await notify_clients(user["store_id"])
    return res


@router.delete("/{table_id}", dependencies=[Depends(require_permission('products.write'))])
async def delete_table(table_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    async def remove(session):
        await ensure_idle(db,user['store_id'],[table_id],session)
        res=await db.tables.delete_one({'id':table_id,'store_id':user['store_id']},session=session)
        if not res.deleted_count:raise HTTPException(404,'Meja tidak ditemukan.')
    await transactions.run_transaction(db,remove)
    await notify_clients(user["store_id"])
    return {"ok": True}


# ---------- Dining Sessions ----------

@router.post("/{table_id}/session", response_model=OrderSession)
async def open_session(table_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    async def open_table(session):
        scope={'id':table_id,'store_id':user['store_id']}
        table=await db.tables.find_one(scope,session=session)
        if not table:raise HTTPException(404,'Meja tidak ditemukan.')
        # Acquire a write before the predicate read so concurrent opens retry
        # against a fresh transaction snapshot rather than creating duplicates.
        await db.tables.update_one(scope,{'$inc':{'session_revision':1}},session=session)
        active=await db.order_sessions.find({'table_id':table_id,'store_id':user['store_id'],'status':'Active'},session=session).limit(2).to_list(2)
        if len(active)>1:raise HTTPException(409,'Meja memiliki sesi ganda. Minta Owner memeriksa tagihan sebelum melanjutkan.')
        if active:return _strip_id(active[0])
        doc={'id':str(uuid.uuid4()),'table_id':table_id,'store_id':user['store_id'],'opened_at':utcnow().isoformat(),'closed_at':None,'status':'Active'}
        await db.order_sessions.insert_one(dict(doc),session=session)
        await db.tables.update_one(scope,{'$set':{'status':'Seated','updated_at':utcnow().isoformat()}},session=session)
        return doc
    doc=await transactions.run_transaction(db,open_table)
    await notify_clients(user["store_id"])
    return _strip_id(doc)


@router.get("/{table_id}/session")
async def get_active_session_bill(table_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    session = await db.order_sessions.find_one({"table_id": table_id, "store_id": user["store_id"], "status": "Active"})
    if not session:
        raise HTTPException(status_code=404, detail="Tidak ada sesi aktif di meja ini")
    
    # Find all orders in this session
    orders = await db.orders.find({"session_id": session["id"], "store_id": user["store_id"], "payment_status": "pending"}, {"_id": 0}).to_list(None)
    split_orders=await db.orders.find({'source_session_id':session['id'],'store_id':user['store_id'],'payment_status':'pending'},{'_id':0}).to_list(None)
    
    subtotal = 0
    discount = 0
    items_summary = []
    
    for o in orders:
        subtotal += o.get("subtotal", 0)
        discount += o.get("discount", 0)
        items_summary.extend(o.get("items", []))
        
    # Preserve the exact saved allocations, including cents retained after splits.
    service_charge=float(sum((Decimal(str(o.get('service_charge',0))) for o in orders),Decimal(0)))
    tax_pb1=float(sum((Decimal(str(o.get('tax_amount',o.get('tax_pb1',0)))) for o in orders),Decimal(0)))
    grand_total=float(sum((Decimal(str(o['total'])) for o in orders),Decimal(0)))
    
    return {
        "session": _strip_id(session),
        "orders": orders,
        'split_orders':split_orders,
        "items": items_summary,
        "subtotal": subtotal,
        "discount": discount,
        "service_charge": service_charge,
        "tax_pb1": tax_pb1,
        "grand_total": grand_total
    }


@router.post('/{table_id}/checkout')
async def settle_session(table_id: str, payment_method: str = Body(..., embed=True), cash_received: Optional[float] = Body(None, embed=True), expected_session_id: Optional[str] = Body(None, embed=True), checked_in_bank: bool = Body(False, embed=True), received_amount: Optional[float] = Body(None, embed=True), expected_total: Optional[float] = Body(None,embed=True,ge=0,allow_inf_nan=False), user: dict = Depends(get_current_user)):
    result = await settle_table(get_db(), user, table_id, payment_method, expected=expected_session_id, cash=cash_received, checked=checked_in_bank, amount=received_amount,expected_total=expected_total)
    await notify_clients(user['store_id'])
    return result


@router.post('/{table_id}/close-empty')
async def close_empty_session(table_id:str,expected_session_id:str=Body(...,embed=True),user:dict=Depends(get_current_user)):
    result=await close_empty(get_db(),user,table_id,expected_session_id)
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
