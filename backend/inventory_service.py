from product_scope import product_scope, inventory_scope
"""Atomic adjustments and branch transfers for counted products and raw ingredients."""
import hashlib
import json
import re
from uuid import uuid4
from fastapi import HTTPException
from database import utcnow
from stock_ledger import movement
from purchase_service import collection, quantity
from plan_limits import plan_rank

def identity(store,kind,key,body):
    return store+':'+kind+':'+hashlib.sha256((key or str(uuid4())).encode()).hexdigest(),hashlib.sha256(json.dumps(body,sort_keys=True).encode()).hexdigest()

def public(doc):return {key:value for key,value in doc.items() if key not in ('_id','request_hash')}

async def adjustment(db,payload,user,session):
    if payload.kind=='ingredient' and plan_rank(user.get('plan'))<plan_rank('pro'):raise HTTPException(403,'Pengaturan bahan baku tersedia mulai paket Pro.')
    scope=inventory_scope(user['store_id'],payload.kind);target=collection(db,payload.kind)
    if payload.product_id:scope['id']=payload.product_id
    elif payload.sku:scope['sku']=payload.sku
    else:raise HTTPException(422,'Pilih barang atau bahan yang akan disesuaikan.')
    records=await target.find(scope,session=session).limit(2).to_list(2)
    if not records:raise HTTPException(404,'Barang atau bahan tidak ditemukan di restoran ini.')
    if len(records)!=1:raise HTTPException(409,'SKU duplikat. Pilih ulang barang dengan ID.')
    record=records[0];qty=quantity(payload.adjustment_qty,payload.kind)
    if payload.kind=='product' and record.get('recipe'):raise HTTPException(422,'Untuk menu resep, sesuaikan stok bahan bakunya.')
    key,digest=identity(user['store_id'],'adjustment',payload.request_id,{'id':record['id'],'kind':payload.kind,'qty':qty,'type':payload.type,'reason':payload.reason})
    prior=await db.stock_adjustments.find_one({'_id':key},session=session)
    if prior:
        if prior.get('request_hash')!=digest:raise HTTPException(409,'Referensi penyesuaian sudah dipakai untuk data berbeda.')
        return public(prior)
    delta=qty if payload.type=='add' else -qty
    scope=inventory_scope(user['store_id'],payload.kind,id=record['id'])
    if delta<0:scope['stock']={'$gte':-delta}
    changed=await target.update_one(scope,{'$inc':{'stock':delta}},session=session)
    if not changed.modified_count:raise HTTPException(409,'Stok tidak cukup untuk pengurangan ini.')
    identifier=str(uuid4());at=utcnow().isoformat()
    doc={'_id':key,'id':identifier,'store_id':user['store_id'],'product_id':record['id'],'kind':payload.kind,
         'product_name':record['name'],'sku':record.get('sku'),'adjustment_qty':qty,'type':payload.type,'reason':payload.reason,
         'created_by':user.get('email') or user['id'],'created_at':at,'request_hash':digest}
    await db.stock_adjustments.insert_one(dict(doc),session=session)
    await movement(db,session,identifier=identifier+':adjustment',store_id=user['store_id'],product_id=record['id'],name=record['name'],quantity=delta,reference='ADJ-'+identifier[:8].upper(),kind='ingredient_adjustment' if payload.kind=='ingredient' else 'adjustment',actor=user['id'],at=at)
    return public(doc)

async def branch(db,store,value,session):
    if value=='main':return {'id':'main','name':'Restoran utama'}
    rows=await db.branches.find({'store_id':store,'$or':[{'id':value},{'name':value}]},session=session).limit(2).to_list(2)
    if len(rows)!=1 or not re.fullmatch(r'[A-Za-z0-9_-]{1,100}',rows[0]['id']):raise HTTPException(422,'Cabang tidak ditemukan di restoran ini.')
    return rows[0]

def stock_field(location):return 'stock' if location=='main' else 'stock_by_branch.'+location

async def ship(db,payload,user,session):
    store=user['store_id'];source=await branch(db,store,payload.from_branch,session);destination=await branch(db,store,payload.to_branch,session)
    if source['id']==destination['id']:raise HTTPException(422,'Cabang asal dan tujuan harus berbeda.')
    keys=[(item.kind,item.product_id) for item in payload.items]
    if len(set(keys))!=len(keys):raise HTTPException(422,'Barang transfer duplikat.')
    key,digest=identity(store,'transfer',payload.request_id,{'from':source['id'],'to':destination['id'],'items':[item.model_dump() for item in payload.items]})
    prior=await db.stock_transfers.find_one({'_id':key},session=session)
    if prior:
        if prior.get('request_hash')!=digest:raise HTTPException(409,'Referensi transfer sudah dipakai untuk rincian berbeda.')
        return public(prior)
    identifier=str(uuid4());at=utcnow().isoformat();lines=[]
    for item in payload.items:
        qty=quantity(item.qty,item.kind);target=collection(db,item.kind);scope=inventory_scope(store,item.kind,id=item.product_id)
        record=await target.find_one(scope,session=session)
        if not record:raise HTTPException(404,'Barang atau bahan transfer tidak ditemukan.')
        if item.kind=='product' and record.get('recipe'):raise HTTPException(422,'Pindahkan bahan baku untuk menu resep.')
        field=stock_field(source['id'])
        changed=await target.update_one({**scope,field:{'$gte':qty}},{'$inc':{field:-qty}},session=session)
        if not changed.modified_count:raise HTTPException(409,'Stok di cabang asal tidak cukup.')
        lines.append({'product_id':record['id'],'kind':item.kind,'name':record['name'],'qty':qty})
        await movement(db,session,identifier=f'{identifier}:ship:{item.kind}:{record["id"]}',store_id=store,product_id=record['id'],name=record['name'],quantity=-qty,reference='TR-'+identifier[:8].upper(),kind='transfer_shipped',actor=user['id'],at=at,branch_id=source['id'])
    doc={'_id':key,'id':identifier,'store_id':store,'from_branch':source['name'],'to_branch':destination['name'],'from_branch_id':source['id'],'to_branch_id':destination['id'],'items':lines,'status':'Shipped','inventory_applied':True,'created_at':at,'request_hash':digest}
    await db.stock_transfers.insert_one(dict(doc),session=session)
    return public(doc)

async def finish_transfer(db,identifier,user,session,cancel=False):
    scope={'store_id':user['store_id'],'id':identifier};record=await db.stock_transfers.find_one(scope,session=session)
    if not record:raise HTTPException(404,'Transfer tidak ditemukan.')
    final='Cancelled' if cancel else 'Received'
    if record['status']==final:return public(record)
    if record['status']!='Shipped' or not record.get('inventory_applied'):raise HTTPException(409,'Transfer lama hanya berupa catatan atau sudah ditutup. Stok tidak diubah.')
    destination=record['from_branch_id'] if cancel else record['to_branch_id'];at=utcnow().isoformat()
    for line in record['items']:
        kind=line.get('kind','product');target=collection(db,kind);item_scope=inventory_scope(user['store_id'],kind,id=line['product_id'])
        if not await target.find_one(item_scope,session=session):raise HTTPException(409,'Barang transfer telah dihapus. Hubungi Owner.')
        await target.update_one(item_scope,{'$inc':{stock_field(destination):line['qty']}},session=session)
        await movement(db,session,identifier=f'{identifier}:{final}:{kind}:{line["product_id"]}',store_id=user['store_id'],product_id=line['product_id'],name=line['name'],quantity=line['qty'],reference='TR-'+identifier[:8].upper(),kind='transfer_cancelled' if cancel else 'transfer_received',actor=user['id'],at=at,branch_id=destination)
    await db.stock_transfers.update_one(scope,{'$set':{'status':final,'updated_at':at,'closed_by':user['id']}},session=session)
    return public({**record,'status':final,'updated_at':at})
