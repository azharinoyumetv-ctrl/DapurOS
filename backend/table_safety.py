"""Prevent layout edits from orphaning dining sessions and unpaid bills."""
from fastapi import HTTPException
from database import utcnow


async def ensure_idle(db, store_id, table_ids, session,allow_reservations=False,allow_calendar=False):
    if not allow_reservations and await db.tables.find_one({'store_id':store_id,'id':{'$in':table_ids},'reservation':{'$ne':None}},session=session):
        raise HTTPException(409,'Batalkan reservasi atau tempatkan tamu sebelum mengubah tata letak meja.')
    if not allow_reservations and not allow_calendar and await db.table_bookings.find_one({
        'store_id':store_id, 'table_id':{'$in':table_ids}, 'status':'booked', 'end_at':{'$gt':utcnow().isoformat()},
    }, session=session):
        raise HTTPException(409, 'Pindahkan atau batalkan reservasi terjadwal sebelum menghapus meja atau lantai.')
    if await db.order_sessions.find_one(
        {'store_id': store_id, 'table_id': {'$in': table_ids}, 'status': 'Active'}, session=session
    ):
        raise HTTPException(409, 'Selesaikan atau tutup sesi meja di Kasir sebelum mengubah tata letak.')
