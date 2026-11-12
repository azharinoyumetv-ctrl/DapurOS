"""Tables, Sessions, and Split Billing routes for DapurOS."""
import uuid
from datetime import date
from typing import List, Optional, Literal
from fastapi import APIRouter, Depends, HTTPException, Body, Header, Query
from pydantic import BaseModel
from pymongo.errors import DuplicateKeyError

from database import get_db, utcnow
from models import Table, TableCreate, TableUpdate, OrderSession, Order, TableReservationCreate
from plan_limits import require_plan
import table_reservations
import reservation_calendar
from auth import get_current_user
from routes_orders import _calc
from restaurant_billing import settle_table, split_table, settle_split
from restaurant_billing import close_empty
from table_payments import find_payment, public_payment, start_table_payment
from table_payment_status import refresh_table_payment
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
    tables = await cursor.to_list(length=200)
    if tables:
        now = utcnow().isoformat()
        due = await db.table_bookings.distinct("table_id", {
            "store_id": user["store_id"], "table_id": {"$in": [table["id"] for table in tables]},
            "status": "booked", "start_at": {"$lte": now}, "end_at": {"$gt": now},
        })
        for table in tables:
            table["scheduled_due"] = table["id"] in due
    return tables


@router.get("/schedule")
async def reservation_agenda(day: Optional[date] = None, user: dict = Depends(get_current_user)):
    return await reservation_calendar.agenda(get_db(), user["store_id"], day)


@router.get("/schedule/availability")
async def scheduled_table_availability(local_start: str = Query(pattern=r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$"),
                                       duration_minutes: int = Query(ge=15, le=reservation_calendar.MAX_BOOKING_MINUTES), party_size: int = Query(ge=1, le=1000),
                                       exclude: Optional[uuid.UUID] = None, user: dict = Depends(get_current_user)):
    try:
        value = reservation_calendar.parse_local_start(local_start)
    except ValueError:
        raise HTTPException(422, "Tanggal reservasi tidak valid.") from None
    return await reservation_calendar.slot_tables(get_db(), user["store_id"], value, duration_minutes, party_size, exclude)


@router.post("/schedule")
async def create_scheduled_reservation(payload: reservation_calendar.BookingInput, user: dict = Depends(require_plan("business"))):
    db = get_db()
    try:
        result = await transactions.run_transaction(db, lambda session: reservation_calendar.save(db, user, payload, session))
    except DuplicateKeyError:
        result = await transactions.run_transaction(db, lambda session: reservation_calendar.save(db, user, payload, session))
    await notify_clients(user["store_id"])
    return result


@router.put("/schedule/{identifier}")
async def edit_scheduled_reservation(identifier: uuid.UUID, payload: reservation_calendar.BookingEdit,
                                     user: dict = Depends(require_plan("business"))):
    db = get_db()
    result = await transactions.run_transaction(db, lambda session: reservation_calendar.save(db, user, payload, session, str(identifier)))
    await notify_clients(user["store_id"])
    return result


@router.post("/schedule/{identifier}/close")
async def close_scheduled_reservation(identifier: uuid.UUID, expected_version: int = Body(..., embed=True, ge=1),
                                      status: Literal["cancelled", "no_show"] = Body(..., embed=True),
                                      user: dict = Depends(get_current_user)):
    db = get_db()
    result = await transactions.run_transaction(db, lambda session: reservation_calendar.close_booking(
        db, user, str(identifier), expected_version, status, session))
    await notify_clients(user["store_id"])
    return result


@router.post("", response_model=Table, dependencies=[Depends(require_permission('products.write'))])
async def create_table(payload: TableCreate, user: dict = Depends(get_current_user)):
    if payload.status=='Reserved':raise HTTPException(422,'Gunakan tindakan Reservasi untuk menyimpan nama pelanggan.')
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
        existing=await db.tables.find_one(scope,session=session)
        if not existing:raise HTTPException(404,'Meja tidak ditemukan.')
        if update.get('status')=='Reserved':raise HTTPException(422,'Gunakan tindakan Reservasi untuk menyimpan nama pelanggan.')
        if existing.get('reservation'):await ensure_idle(db,user['store_id'],[table_id],session)
        if update.get('status')=='Vacant':await ensure_idle(db,user['store_id'],[table_id],session,allow_calendar=True)
        if "capacity" in update and await reservation_calendar.upcoming(db, user["store_id"], table_id, session, minimum_party=update["capacity"]):
            raise HTTPException(409, "Kapasitas baru terlalu kecil untuk reservasi terjadwal.")
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
async def open_session(table_id: str, expected_reservation_id:Optional[str]=Body(None,embed=True,max_length=200),
                       scheduled_reservation_id: Optional[uuid.UUID] = Body(None, embed=True),
                       expected_version: Optional[int] = Body(None, embed=True, ge=1), user: dict = Depends(get_current_user)):
    if scheduled_reservation_id and (not expected_version or expected_reservation_id):
        raise HTTPException(422, "Pilih satu reservasi beserta versinya.")
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
        if active:
            if scheduled_reservation_id and (active[0].get('reservation') or {}).get('id') != str(scheduled_reservation_id):
                raise HTTPException(409, "Meja sudah memiliki sesi aktif.")
            if expected_reservation_id and (active[0].get('reservation') or {}).get('id')!=expected_reservation_id:raise HTTPException(409,'Sesi meja sudah berubah. Muat ulang meja.')
            return _strip_id(active[0])
        reservation=table.get('reservation')
        if scheduled_reservation_id:
            reservation = await reservation_calendar.seat(db, user, table, str(scheduled_reservation_id), expected_version, session)
        elif (reservation and (reservation.get('id')!=expected_reservation_id or table.get('status')!='Reserved')) or (expected_reservation_id and not reservation):
            raise HTTPException(409,'Meja memiliki reservasi atau reservasi sudah berubah. Pilih Tempatkan Tamu dari reservasi terbaru.')
        elif not reservation and await reservation_calendar.current_booking(db, user["store_id"], table_id, session):
            raise HTTPException(409, "Jadwal reservasi meja sedang berlangsung. Tempatkan tamu dari Kalender Reservasi.")
        doc={'id':str(uuid.uuid4()),'table_id':table_id,'store_id':user['store_id'],'opened_at':utcnow().isoformat(),'closed_at':None,'status':'Active'}
        if reservation:doc['reservation']=reservation
        await db.order_sessions.insert_one(dict(doc),session=session)
        await db.tables.update_one(scope,{'$set':{'status':'Seated','updated_at':utcnow().isoformat()},'$unset':{'reservation':''}},session=session)
        return doc
    doc=await transactions.run_transaction(db,open_table)
    await notify_clients(user["store_id"])
    return _strip_id(doc)


@router.post('/{table_id}/reservation',response_model=Table)
async def reserve_table(table_id:str,payload:TableReservationCreate,user:dict=Depends(require_plan('business'))):
    db=get_db()
    result=await transactions.run_transaction(db,lambda session:table_reservations.save(db,user,table_id,payload,session))
    await notify_clients(user['store_id'])
    return result


@router.post('/{table_id}/reservation/cancel',response_model=Table)
async def cancel_reservation(table_id:str,expected_reservation_id:str=Body(...,embed=True,min_length=1,max_length=200),user:dict=Depends(get_current_user)):
    # Staff can honor or cancel an existing booking after a plan downgrade.
    db=get_db()
    result=await transactions.run_transaction(db,lambda session:table_reservations.cancel(db,user,table_id,expected_reservation_id,session))
    await notify_clients(user['store_id'])
    return result


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
    
    payment = await find_payment(db, {"_id": session["gateway_payment_id"], "store_id": user["store_id"]}) if session.get("gateway_payment_id") else None
    return {
        "session": _strip_id(session),
        "orders": orders,
        'split_orders':split_orders,
        "items": items_summary,
        "subtotal": subtotal,
        "discount": discount,
        "service_charge": service_charge,
        "tax_pb1": tax_pb1,
        "grand_total": grand_total,
        "gateway_payment": public_payment(payment) if payment else None,
    }


@router.post('/{table_id}/gateway-payment')
async def start_gateway_payment(table_id: str, payment_method: str = Body(..., embed=True),
        expected_session_id: str = Body(..., embed=True), expected_total: float = Body(..., embed=True, ge=0, allow_inf_nan=False),
        ewallet_channel: Optional[str] = Body(None, embed=True), user: dict = Depends(get_current_user)):
    return await start_table_payment(get_db(), user, table_id, payment_method, expected_session_id, expected_total, ewallet_channel)


@router.get('/{table_id}/gateway-payment/{payment_id}')
async def gateway_payment_status(table_id: str, payment_id: str, user: dict = Depends(get_current_user)):
    payment = await find_payment(get_db(), {'_id': payment_id, 'table_id': table_id, 'store_id': user['store_id']})
    if not payment:
        raise HTTPException(404, 'Pembayaran meja tidak ditemukan.')
    return public_payment(payment)


@router.post('/{table_id}/gateway-payment/{payment_id}/refresh')
async def check_gateway_payment(table_id: str, payment_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    payment = await find_payment(db, {'_id': payment_id, 'table_id': table_id, 'store_id': user['store_id']})
    if not payment:
        raise HTTPException(404, 'Pembayaran meja tidak ditemukan.')
    return public_payment(await refresh_table_payment(db, payment))


@router.post('/{table_id}/checkout')
async def settle_session(table_id: str, payment_method: str = Body(..., embed=True), cash_received: Optional[float] = Body(None, embed=True, ge=0, le=1_000_000_000_000_000, allow_inf_nan=False), expected_session_id: Optional[str] = Body(None, embed=True), checked_in_bank: bool = Body(False, embed=True), received_amount: Optional[float] = Body(None, embed=True), expected_total: Optional[float] = Body(None,embed=True,ge=0,allow_inf_nan=False), user: dict = Depends(get_current_user)):
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
async def settle_split_order(table_id: str, order_id: str, payment_method: str = Body(..., embed=True),
                             cash_received: Optional[float] = Body(None, embed=True, ge=0, le=1_000_000_000_000_000, allow_inf_nan=False),
                             expected_total: Optional[float] = Body(None, embed=True, ge=0, le=1_000_000_000_000_000, allow_inf_nan=False),
                             user: dict = Depends(get_current_user)):
    result = await settle_split(get_db(), user, table_id, order_id, payment_method, cash=cash_received, expected_total=expected_total)
    await notify_clients(user["store_id"])
    return result
