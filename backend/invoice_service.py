"""An invoice and its payable are one obligation, committed together."""
import hashlib
import json
from uuid import uuid4
from fastapi import HTTPException
from database import utcnow


def public(record):return {key:value for key,value in record.items() if key not in ('_id','request_hash')}


async def create(db,payload,user,session):
    values=payload.model_dump();values['invoice_no']=values['invoice_no'].strip();values['po_no']=values['po_no'].strip()
    if not values['invoice_no']:raise HTTPException(422,'Nomor faktur wajib diisi.')
    store=user['store_id']
    await db.capacity_guards.update_one({'_id':store+':invoices'},{'$inc':{'revision':1}},upsert=True,session=session)
    rows=await db.supplier_invoices.find({'store_id':store,'invoice_no':values['invoice_no']},session=session).limit(2).to_list(2)
    digest=hashlib.sha256(json.dumps(values,sort_keys=True).encode()).hexdigest()
    if rows:
        if len(rows)!=1 or rows[0].get('request_hash')!=digest:raise HTTPException(409,'Nomor faktur sudah dipakai. Periksa faktur yang ada.')
        return public(rows[0])
    po=await db.purchase_orders.find_one({'store_id':store,'po_no':values['po_no']},session=session)
    if not po:raise HTTPException(404,'PO tidak ditemukan di restoran ini.')
    identifier=str(uuid4());at=utcnow().isoformat()
    record={'id':identifier,'store_id':store,**values,'created_at':at,'request_hash':digest}
    await db.supplier_invoices.insert_one(dict(record),session=session)
    if values['status']=='Unpaid':
        await db.debt_payables.insert_one({'id':str(uuid4()),'store_id':store,'invoice_id':identifier,'invoice_no':values['invoice_no'],
            'supplier_name':po['supplier_name'],'amount':values['amount'],'paid_amount':0,'due_date':values['due_date'],'status':'Unpaid','created_at':at},session=session)
    return public(record)


async def settle(db,identifier,payload,user,session):
    scope={'id':identifier,'store_id':user['store_id']};record=await db.supplier_invoices.find_one(scope,session=session)
    if not record:raise HTTPException(404,'Faktur tidak ditemukan.')
    if record['amount']<=0:raise HTTPException(409,'Nominal faktur lama tidak valid. Minta Owner memeriksa tagihan sebelum mencatat pembayaran.')
    if payload.status!='Paid':
        if payload.status==record['status']:return public(record)
        raise HTTPException(409,'Status mengikuti pembayaran. Catat cicilan melalui Utang; pembayaran yang sudah dicatat tidak dapat dibuka ulang di sini.')
    duplicates=await db.supplier_invoices.count_documents({'store_id':user['store_id'],'invoice_no':record['invoice_no']},session=session)
    payables=await db.debt_payables.find({'store_id':user['store_id'],'invoice_no':record['invoice_no']},session=session).limit(2).to_list(2)
    if duplicates!=1 or len(payables)>1 or any(row['amount']!=record['amount'] for row in payables):raise HTTPException(409,'Catatan faktur/utang tidak cocok atau ganda. Minta Owner memeriksa tagihan.')
    for payable in payables:
        await db.debt_payables.update_one({'store_id':user['store_id'],'id':payable['id']},{'$set':{'paid_amount':record['amount'],'status':'Paid'}},session=session)
    await db.supplier_invoices.update_one(scope,{'$set':{'status':'Paid','paid_amount':record['amount']}},session=session)
    return public({**record,'status':'Paid'})
