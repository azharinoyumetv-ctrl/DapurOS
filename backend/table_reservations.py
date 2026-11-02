"""Named table holds, serialized with dining sessions in existing fenced collections."""
import hashlib
import json
from uuid import uuid4
from fastapi import HTTPException
from database import utcnow
from table_safety import ensure_idle


def public_table(table):
    return {key:value for key,value in table.items() if key!='_id'}


async def save(db,user,table_id,payload,session):
    scope={'id':table_id,'store_id':user['store_id']}
    table=await db.tables.find_one(scope,session=session)
    if not table:raise HTTPException(404,'Meja tidak ditemukan.')
    await db.tables.update_one(scope,{'$inc':{'session_revision':1}},session=session)
    attempt=user['store_id']+':table-reservation:'+payload.request_id
    digest=hashlib.sha256(json.dumps({'table_id':table_id,'actor':user['id'],**payload.model_dump(mode='json')},sort_keys=True).encode()).hexdigest()
    prior=await db.checkout_attempts.find_one({'_id':attempt},session=session)
    if prior:
        if prior.get('request_hash')!=digest:raise HTTPException(409,'Referensi reservasi sudah digunakan untuk data berbeda.')
        return public_table(table)
    current=table.get('reservation')
    if current:
        if current.get('id')!=payload.expected_reservation_id:raise HTTPException(409,'Meja sudah dipesan. Muat ulang reservasi sebelum mengubahnya.')
    elif payload.expected_reservation_id:
        raise HTTPException(409,'Reservasi sudah berubah atau tamu sudah ditempatkan. Muat ulang meja.')
    if not current and table.get('status','Vacant')!='Vacant':raise HTTPException(409,'Meja sedang digunakan dan belum dapat direservasi.')
    await ensure_idle(db,user['store_id'],[table_id],session,allow_reservations=True)
    if payload.party_size>table.get('capacity',0):raise HTTPException(422,'Jumlah tamu melebihi kapasitas meja.')
    now=utcnow().isoformat()
    reservation={'id':str(uuid4()),'customer_name':payload.customer_name,'phone':payload.phone,'party_size':payload.party_size,
                 'arrival_at':payload.arrival_at.isoformat() if payload.arrival_at else None,'note':payload.note,
                 'created_at':(current or {}).get('created_at',now),'created_by':(current or {}).get('created_by',user['id']),
                 'updated_at':now,'updated_by':user['id']}
    await db.tables.update_one(scope,{'$set':{'status':'Reserved','reservation':reservation,'updated_at':now}},session=session)
    await db.checkout_attempts.insert_one({'_id':attempt,'store_id':user['store_id'],'kind':'table_reservation','request_hash':digest,
                                         'table_id':table_id,'reservation':reservation},session=session)
    return public_table({**table,'status':'Reserved','reservation':reservation,'updated_at':now})


async def cancel(db,user,table_id,expected,session):
    scope={'id':table_id,'store_id':user['store_id']}
    table=await db.tables.find_one(scope,session=session)
    if not table:raise HTTPException(404,'Meja tidak ditemukan.')
    await db.tables.update_one(scope,{'$inc':{'session_revision':1}},session=session)
    record_id=user['store_id']+':reservation-cancel:'+expected
    if not table.get('reservation') and table.get('status')=='Vacant' and await db.checkout_attempts.find_one({'_id':record_id,'table_id':table_id},session=session):return public_table(table)
    reservation=table.get('reservation')
    if not reservation or reservation.get('id')!=expected or table.get('status')!='Reserved':raise HTTPException(409,'Reservasi sudah berubah. Muat ulang meja sebelum membatalkan.')
    await ensure_idle(db,user['store_id'],[table_id],session,allow_reservations=True)
    now=utcnow().isoformat()
    await db.tables.update_one(scope,{'$set':{'status':'Vacant','updated_at':now},'$unset':{'reservation':''}},session=session)
    await db.checkout_attempts.insert_one({'_id':record_id,'store_id':user['store_id'],'kind':'table_reservation_cancel',
                                         'table_id':table_id,'reservation':reservation,'cancelled_at':now,'cancelled_by':user['id']},session=session)
    return public_table({**table,'status':'Vacant','reservation':None,'updated_at':now})
