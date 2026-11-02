from product_scope import product_scope, inventory_scope
"""Bounded public table ordering; it never grants an operator session or payment access."""
import hashlib
import json
import math
import re
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from typing import List
import transactions
from auth import get_current_user, resolve_user_context
from database import get_db, utcnow
from erasure_guard import actor_context, actor_expiry
from models import OrderCreate
from paging import encode_cursor, decode_cursor
from permissions import require_permission
from plan_limits import require_plan, plan_rank
from routes_orders import create_order

router=APIRouter(prefix='/api/public/qr',tags=['guest-ordering'])
staff_router=APIRouter(prefix='/api/tables',tags=['table-qr'],dependencies=[Depends(require_permission('pos.use'))])
MENU_PAGE_SIZE=20

class QrConfiguration(BaseModel):
    model_config=ConfigDict(extra='forbid')
    enabled: bool=True
    rotate: bool=False

class GuestItem(BaseModel):
    model_config=ConfigDict(extra='forbid')
    product_id: str=Field(min_length=1,max_length=200)
    quantity: int=Field(ge=1,le=20)
    expected_price: float=Field(ge=0,le=1_000_000_000_000,allow_inf_nan=False)
    note: str=Field(default='',max_length=500)

class GuestOrder(BaseModel):
    model_config=ConfigDict(extra='forbid')
    items: List[GuestItem]=Field(min_length=1,max_length=20)

def link(table):
    enabled=table.get('qr_enabled') is True and bool(table.get('qr_token'))
    return {'enabled':enabled,'url':'https://dagangos.com/dapuros/qr-order?token='+table['qr_token'] if enabled else None}

@staff_router.get('/{table_id}/qr-link')
async def read_qr(table_id: str,user: dict=Depends(require_plan('pro'))):
    table=await get_db().tables.find_one({'id':table_id,'store_id':user['store_id']})
    if not table:raise HTTPException(404,'Meja tidak ditemukan.')
    return link(table)

@staff_router.post('/{table_id}/qr-link',dependencies=[Depends(require_permission('products.write'))])
async def configure_qr(table_id: str,payload: QrConfiguration,user: dict=Depends(require_plan('pro'))):
    db=get_db()
    async def save(session):
        table=await db.tables.find_one({'id':table_id,'store_id':user['store_id']},session=session)
        store=await db.stores.find_one({'id':user['store_id']},session=session)
        if not table or not store:raise HTTPException(404,'Meja tidak ditemukan.')
        owner=store.get('owner_user_id') or (user['id'] if user.get('is_store_owner') else None)
        if not owner:raise HTTPException(409,'Minta Owner menyiapkan QR meja ini.')
        token=secrets.token_hex(32) if payload.rotate or not table.get('qr_token') else table['qr_token']
        fields={'qr_enabled':payload.enabled,'qr_token':token,'qr_token_hash':hashlib.sha256(token.encode()).hexdigest(),'qr_owner_id':owner}
        await db.tables.update_one({'id':table_id,'store_id':user['store_id']},{'$set':fields},session=session)
        return link({**table,**fields})
    return await transactions.run_transaction(db,save)

async def public_context(token):
    if not re.fullmatch(r'[a-f0-9]{64}',token):raise HTTPException(404,'QR tidak valid. Minta QR terbaru kepada staf.')
    digest=hashlib.sha256(token.encode()).hexdigest();db=get_db()
    table=await db.tables.find_one({'qr_token_hash':digest,'qr_enabled':True})
    if not table:raise HTTPException(404,'QR tidak aktif. Silakan hubungi staf.')
    store=await db.stores.find_one({'id':table['store_id']})
    owner=await db.users.find_one({'id':table.get('qr_owner_id')},{'_id':0,'password_hash':0})
    if not store or not owner or store.get('module') not in (None,'dapuros') or store.get('owner_user_id',owner['id'])!=owner['id']:
        raise HTTPException(404,'Menu meja belum dapat dibuka. Silakan hubungi staf.')
    try:account=await resolve_user_context(owner,'dapuros')
    except HTTPException:raise HTTPException(403,'Menu meja sedang tidak aktif. Silakan hubungi staf.') from None
    if account.get('store_id')!=store['id'] or plan_rank(account.get('plan'))<plan_rank('pro'):
        raise HTTPException(403,'Menu meja sedang tidak aktif. Silakan hubungi staf.')
    return db,table,store,account,digest

async def available(db,store_id,product,session=None,ingredients=None):
    if product.get('active') is False:return False
    recipe=product.get('recipe') or []
    if not recipe:return product.get('stock',0)>0
    for item in recipe:
        qty=item.get('quantity',item.get('qty',0))
        if not isinstance(qty,(int,float)) or not math.isfinite(qty) or qty<=0:return False
        ingredient=ingredients.get(item['ingredient_id']) if ingredients is not None else await db.ingredients.find_one({'store_id':store_id,'id':item['ingredient_id']},session=session)
        if not ingredient or ingredient.get('stock',0)<qty:return False
    return True

@router.get('/{token}')
async def menu(token: str,cursor: str|None=None,q: str=Query('',max_length=80)):
    db,table,store,owner,digest=await public_context(token)
    scope={**product_scope(store['id']),'active':{'$ne':False}}
    if q.strip():scope['name']={'$regex':re.escape(q.strip()),'$options':'i'}
    query=dict(scope)
    if cursor:query['id']={'$gt':decode_cursor(cursor,['id'])['id']}
    rows=await db.products.find(query,{'_id':0}).sort('id',1).limit(MENU_PAGE_SIZE+1).to_list(MENU_PAGE_SIZE+1)
    ingredient_ids={item['ingredient_id'] for product in rows[:MENU_PAGE_SIZE] for item in product.get('recipe') or []}
    ingredients={item['id']:item for item in await db.ingredients.find({'store_id':store['id'],'id':{'$in':list(ingredient_ids)}},{'_id':0,'id':1,'stock':1}).to_list(None)}
    items=[]
    for product in rows[:MENU_PAGE_SIZE]:
        price=product.get('price')
        if not isinstance(price,(int,float)) or not math.isfinite(price) or price<0:continue
        items.append({'id':product['id'],'name':product['name'],'price':price,'category':product.get('category') or 'Menu',
                      'description':product.get('description') or '', 'image_url':product.get('image_url'),
                      'available':await available(db,store['id'],product,ingredients=ingredients)})
    settings=await db.settings.find_one({'store_id':store['id']}) or {}
    active=await db.order_sessions.count_documents({'store_id':store['id'],'table_id':table['id'],'status':'Active'})
    return {'restaurant':(settings.get('general') or {}).get('store_name') or store.get('name') or 'Restoran',
            'table':table['label'],'session_active':active==1,'items':items,'total':await db.products.count_documents(scope),
            'next_cursor':encode_cursor({'id':rows[MENU_PAGE_SIZE-1]['id']}) if len(rows)>MENU_PAGE_SIZE else None,
            'pricing':{'service_rate':0.05,'tax_rate':0.10},'payment':'pay_at_counter'}

def response(order,table):
    return {'reference':order['order_no'],'total':order['total'],'status':order['payment_status'],'table':table['label']}

@router.post('/{token}/orders')
async def submit(token: str,payload: GuestOrder,idempotency_key: str=Header(alias='Idempotency-Key',min_length=36,max_length=36)):
    try:request_id=str(UUID(idempotency_key))
    except ValueError:raise HTTPException(422,'Referensi pesanan tidak valid.') from None
    db,table,store,owner,digest=await public_context(token)
    fingerprint=hashlib.sha256(json.dumps(payload.model_dump(),sort_keys=True).encode()).hexdigest()
    binding_id=store['id']+':guest-request:'+digest+':'+request_id
    guest_id='guest:'+digest
    # This context only fences writes against the data owner's account. The
    # order's actor remains a Guest and acquires no operator permissions.
    context_token=actor_context.set((owner['id'],'dapuros'))
    expiry=None
    for value in (owner.get('trial_ends_at'),(owner.get('subscription') or {}).get('expires_at')):
        if value:
            try:expiry=datetime.fromisoformat(value.replace('Z','+00:00')).timestamp()
            except ValueError:pass
    expiry_token=actor_expiry.set(expiry)
    try:
        async def claim(session):
            prior=await db.checkout_attempts.find_one({'_id':binding_id},session=session)
            if prior:
                if prior.get('request_hash')!=fingerprint:raise HTTPException(409,'Referensi sudah digunakan untuk keranjang berbeda.')
                if (utcnow()-datetime.fromisoformat(prior['created_at'])).total_seconds()>900:
                    settled=await db.checkout_attempts.find_one({'_id':store['id']+':guest-'+digest+'-'+request_id},session=session)
                    if not settled:raise HTTPException(409,'Keranjang lama sudah kedaluwarsa. Perbarui menu sebelum memesan lagi.')
                return prior
            sessions=await db.order_sessions.find({'store_id':store['id'],'table_id':table['id'],'status':'Active'},session=session).limit(2).to_list(2)
            if len(sessions)!=1:raise HTTPException(409,'Minta staf membuka sesi meja sebelum memesan.')
            now=utcnow();minute=now.strftime('%Y%m%d%H%M')
            rate=await db.capacity_guards.find_one_and_update({'_id':store['id']+':guest-rate:'+digest+':'+minute},
                {'$inc':{'count':1},'$setOnInsert':{'store_id':store['id'],'guest_rate_expires_at':now+timedelta(minutes=2)}},upsert=True,return_document=True,session=session)
            if rate['count']>10:raise HTTPException(429,'Terlalu banyak pesanan. Tunggu sebentar atau hubungi staf.')
            items=[];seen=set()
            for item in payload.items:
                if item.product_id in seen:raise HTTPException(422,'Gabungkan menu yang sama dalam satu baris.')
                seen.add(item.product_id)
                product=await db.products.find_one({**product_scope(store['id'],id=item.product_id),'active':{'$ne':False}},session=session)
                if not product:raise HTTPException(409,'Menu berubah atau tidak tersedia. Perbarui menu.')
                if Decimal(str(product['price']))!=Decimal(str(item.expected_price)):raise HTTPException(409,'Harga menu berubah. Perbarui menu sebelum mengirim.')
                if not await available(db,store['id'],product,session):raise HTTPException(409,'Menu habis. Pilih menu lain atau hubungi staf.')
                items.append({'product_id':product['id'],'name':product['name'],'price':product['price'],'quantity':item.quantity,
                              'subtotal':float(Decimal(str(product['price']))*item.quantity),'note':item.note})
            canonical={'items':items,'payment_method':'cash','session_id':sessions[0]['id'],'dining_option':'Dine-In'}
            doc={'_id':binding_id,'store_id':store['id'],'kind':'guest_request','guest_hash':digest,'request_hash':fingerprint,
                 'created_at':now.isoformat(),'guest_expires_at':now+timedelta(days=30),'payload':canonical}
            await db.checkout_attempts.insert_one(dict(doc),session=session)
            return doc
        binding=await transactions.run_transaction(db,claim)
        guest={'id':guest_id,'email':'','store_id':store['id'],'role':'Guest','plan':owner['plan'],'current_module':'dapuros','store_name':store.get('name'),'guest_table_id':table['id'],'guest_qr_hash':digest}
        order=await create_order(OrderCreate.model_validate(binding['payload']),guest,'guest-'+digest+'-'+request_id)
        return response(order,table)
    finally:
        actor_expiry.reset(expiry_token);actor_context.reset(context_token)

@router.get('/{token}/orders/{request_id}')
async def status(token: str,request_id: str):
    db,table,store,owner,digest=await public_context(token)
    try:identifier=str(UUID(request_id))
    except ValueError:raise HTTPException(404) from None
    attempt=await db.checkout_attempts.find_one({'_id':store['id']+':guest-'+digest+'-'+identifier})
    order=await db.orders.find_one({'id':(attempt or {}).get('order_id'),'store_id':store['id']})
    if not order:raise HTTPException(404,'Pesanan belum ditemukan. Coba kirim lagi dengan referensi yang sama.')
    return response(order,table)
