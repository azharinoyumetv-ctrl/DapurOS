"""Prevent layout edits from orphaning dining sessions and unpaid bills."""
from fastapi import HTTPException


async def ensure_idle(db, store_id, table_ids, session,allow_reservations=False):
    if not allow_reservations and await db.tables.find_one({'store_id':store_id,'id':{'$in':table_ids},'reservation':{'$ne':None}},session=session):
        raise HTTPException(409,'Batalkan reservasi atau tempatkan tamu sebelum mengubah tata letak meja.')
    if await db.order_sessions.find_one(
        {'store_id': store_id, 'table_id': {'$in': table_ids}, 'status': 'Active'}, session=session
    ):
        raise HTTPException(409, 'Selesaikan atau tutup sesi meja di Kasir sebelum mengubah tata letak.')
