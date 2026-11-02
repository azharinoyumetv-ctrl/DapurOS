from product_scope import product_scope, inventory_scope
"""Actual stock events and complete paid-sales windows for restaurant inventory."""
import re
import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from database import get_db, utcnow
from permissions import require_permission
from plan_limits import require_plan
from paging import encode_cursor, decode_cursor
from store_time import store_zone
from fastapi.responses import Response

router=APIRouter(prefix='/api',tags=['stock_history'])


@router.get('/inventory/movements',dependencies=[Depends(require_permission('inventory.read'))])
async def movements(user:dict=Depends(require_plan('pro')),cursor:Optional[str]=None,limit:int=Query(50,ge=1,le=100),q:str=Query('',max_length=200)):
    db=get_db();scope={'store_id':user['store_id']}
    if q.strip():scope['$or']=[{field:{'$regex':re.escape(q.strip()),'$options':'i'}} for field in ('product_name','reference')]
    query=dict(scope)
    if cursor:
        after=decode_cursor(cursor,['created_at','id'])
        query={'$and':[scope,{'$or':[{'created_at':{'$lt':after['created_at']}},{'created_at':after['created_at'],'id':{'$lt':after['id']}}]}]}
    rows=await db.stock_movements.find(query,{'_id':0}).sort([('created_at',-1),('id',-1)]).limit(limit+1).to_list(limit+1)
    items=rows[:limit]
    return {'items':items,'total':await db.stock_movements.count_documents(scope),'timezone':str(await store_zone(db,user['store_id'])),
            'next_cursor':encode_cursor({key:items[-1][key] for key in ('created_at','id')}) if len(rows)>limit else None,
            'history_note':'Riwayat menampilkan pergerakan yang benar-benar tersimpan. Catatan lama sebelum pencatatan stok lengkap mungkin tidak memiliki rincian. Menu resep menggunakan bahan baku; satuannya mengikuti bahan.'}


@router.get('/reports/inventory/dead-stock',dependencies=[Depends(require_permission('inventory.read'))])
async def dead_stock(user:dict=Depends(require_plan('pro')),cursor:Optional[str]=None,limit:int=Query(50,ge=1,le=100)):
    db=get_db();now=utcnow();after=None;end=now
    if cursor:
        value=decode_cursor(cursor,['id','as_of'])
        try:
            end=datetime.fromisoformat(value['as_of'].replace('Z','+00:00'))
            if not end.tzinfo or end>now:raise ValueError()
            end=end.astimezone(timezone.utc)
        except (ValueError,TypeError):raise HTTPException(400,'Periode tidak valid. Muat ulang laporan.') from None
        after=value['id']
    start=end-timedelta(days=30)
    sold=await db.orders.aggregate([
        {'$match':{'store_id':user['store_id'],'payment_status':'paid','created_at':{'$gte':start.isoformat(),'$lte':end.isoformat()}}},
        {'$unwind':'$items'},{'$match':{'items.quantity':{'$gt':0}}},{'$group':{'_id':'$items.product_id'}}
    ]).to_list(None)
    scope={**product_scope(user['store_id']),'stock':{'$gt':0},'recipe':{'$in':[None,[]]},'id':{'$nin':[row['_id'] for row in sold]}}
    query=dict(scope)
    if after:query['id']={**scope['id'],'$gt':after}
    rows=await db.products.find(query,{'_id':0}).sort('id',1).limit(limit+1).to_list(limit+1);items=rows[:limit]
    return {'items':items,'total':await db.products.count_documents(scope),'days':30,'window_start':start.isoformat(),'window_end':end.isoformat(),
            'next_cursor':encode_cursor({'id':items[-1]['id'],'as_of':end.isoformat()}) if len(rows)>limit else None}


async def tax_rows(db,user):
    zone=await store_zone(db,user['store_id']);now=utcnow();local=now.astimezone(zone)
    start=local.replace(day=1,hour=0,minute=0,second=0,microsecond=0).astimezone(timezone.utc)
    rows=await db.orders.find({'store_id':user['store_id'],'payment_status':'paid','created_at':{'$gte':start.isoformat(),'$lte':now.isoformat()}},
        {'_id':0,'order_no':1,'created_at':1,'subtotal':1,'discount':1,'service_charge':1,'tax_amount':1,'total':1,'payment_method':1}).sort('created_at',1).to_list(None)
    return rows,local.strftime('%Y-%m'),str(zone)


@router.get('/reports/tax',dependencies=[Depends(require_permission('reports.read'))])
async def recorded_tax(user:dict=Depends(require_plan('pro'))):
    rows,period,zone=await tax_rows(get_db(),user)
    return {'period':period,'timezone':zone,'orders':len(rows),**{key:round(sum(row.get(key,0) or 0 for row in rows),2) for key in ('subtotal','discount','service_charge','tax_amount','total')}}


@router.get('/reports/tax.csv',dependencies=[Depends(require_permission('reports.read'))])
async def recorded_tax_csv(user:dict=Depends(require_plan('pro'))):
    rows,period,zone=await tax_rows(get_db(),user);out=io.StringIO(newline='');writer=csv.writer(out)
    fields=['order_no','created_at','subtotal','discount','service_charge','tax_amount','total','payment_method'];writer.writerow(fields)
    for row in rows:writer.writerow([str(row.get(field,'')).lstrip('=+@\t\r\n') for field in fields])
    return Response('\ufeff'+out.getvalue(),media_type='text/csv; charset=utf-8',headers={'Content-Disposition':f'attachment; filename="dapuros-recorded-tax-{period}.csv"','Cache-Control':'private, no-store'})
