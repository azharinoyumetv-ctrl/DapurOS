"""Customer edits preserve earned points and require management for benefits."""
from uuid import uuid4
from fastapi import HTTPException
from database import utcnow
from permissions import has_permission


async def save(db,payload,user,session,identifier=None):
    store=user['store_id'];name=payload.name.strip()
    if not name or len(name)>200:raise HTTPException(422,'Nama pelanggan wajib diisi, maksimal 200 karakter.')
    if not 0<=payload.loyalty_points<=1_000_000_000:raise HTTPException(422,'Jumlah poin tidak valid.')
    await db.capacity_guards.update_one({'_id':store+':customers'},{'$inc':{'revision':1}},upsert=True,session=session)
    record=await db.customers.find_one({'store_id':store,'id':identifier},session=session) if identifier else None
    if identifier and not record:raise HTTPException(404,'Pelanggan tidak ditemukan.')
    if payload.phone:
        duplicate=await db.customers.find_one({'store_id':store,'phone':payload.phone},session=session)
        if duplicate and duplicate['id']!=identifier:raise HTTPException(409,'Nomor telepon pelanggan sudah digunakan.')
    values={key:value for key,value in payload.model_dump(exclude_unset=True).items() if key!='expected_loyalty_points'}
    values['name']=name
    if not record:values={'phone':None,'email':None,'membership_tier':'Bronze','loyalty_points':0,'notes':None,**values}
    if not has_permission(user,'customers.manage') and (values.get('loyalty_points',(record or {}).get('loyalty_points',0))!=(record or {}).get('loyalty_points',0) or values.get('membership_tier',(record or {}).get('membership_tier','Bronze'))!=(record or {}).get('membership_tier','Bronze')):
        raise HTTPException(403,'Owner atau Manager diperlukan untuk mengubah poin dan tingkat keanggotaan.')
    if record:
        if payload.expected_loyalty_points is not None and payload.expected_loyalty_points!=record.get('loyalty_points',0) and values.get('loyalty_points',record.get('loyalty_points',0))!=record.get('loyalty_points',0):raise HTTPException(409,'Poin berubah sejak pelanggan dibuka. Muat ulang data sebelum mengubah poin.')
        await db.customers.update_one({'store_id':store,'id':identifier},{'$set':values},session=session)
        return {key:value for key,value in {**record,**values}.items() if key!='_id'}
    doc={'id':str(uuid4()),'store_id':store,'created_at':utcnow().isoformat(),**values}
    await db.customers.insert_one(dict(doc),session=session)
    return doc
