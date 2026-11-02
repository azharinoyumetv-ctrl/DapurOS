"""Bounded, monotonic debt payments with optional optimistic concurrency."""
from decimal import Decimal
import hashlib
import json
from fastapi import HTTPException
import transactions


def payment_status(amount, paid):
    if Decimal(str(paid)) > Decimal(str(amount)):
        raise HTTPException(422, 'Pembayaran melebihi jumlah tagihan.')
    return 'Paid' if paid == amount else 'Partial' if paid > 0 else 'Unpaid'


async def update_payment(db, collection, identifier, payload, user):
    async def save(session):
        scope={'store_id':user['store_id'],'id':identifier}
        record=await collection.find_one(scope,session=session)
        if not record:raise HTTPException(404,'Catatan tagihan tidak ditemukan.')
        paid=payload.paid_amount
        if paid is None:raise HTTPException(422,'Nominal pembayaran wajib diisi.')
        current=record.get('paid_amount',0)
        if record['amount']<=0 or current<0 or current>record['amount']:raise HTTPException(409,'Catatan tagihan lama tidak valid. Minta Owner memeriksa nominal sebelum menerima pembayaran.')
        attempt_id=user['store_id']+':debt-payment:'+hashlib.sha256(payload.request_id.encode()).hexdigest() if payload.request_id else None
        digest=hashlib.sha256(json.dumps({'collection':collection.name,'id':identifier,'paid':paid,'expected':payload.expected_paid_amount,'actor':user['id']},sort_keys=True).encode()).hexdigest()
        if attempt_id:
            prior=await db.checkout_attempts.find_one({'_id':attempt_id},session=session)
            if prior:
                if prior.get('request_hash')!=digest:raise HTTPException(409,'Referensi pembayaran sudah dipakai untuk tagihan berbeda.')
                return {key:value for key,value in record.items() if key!='_id'}
        if payload.expected_paid_amount is not None and payload.expected_paid_amount!=current:
            raise HTTPException(409,'Pembayaran telah berubah. Muat ulang tagihan sebelum mencatat pembayaran.')
        if paid<current:raise HTTPException(409,'Pembayaran tidak boleh berkurang. Muat ulang tagihan.')
        status=payment_status(record['amount'],paid)
        await collection.update_one(scope,{'$set':{'paid_amount':paid,'status':status}},session=session)
        if attempt_id:await db.checkout_attempts.insert_one({'_id':attempt_id,'store_id':user['store_id'],'kind':'debt_payment','request_hash':digest,'actor_id':user['id'],'debt_id':identifier},session=session)
        if collection.name=='debt_payables' and record.get('invoice_no'):
            invoices=await db.supplier_invoices.find({'store_id':user['store_id'],'invoice_no':record['invoice_no']},session=session).limit(2).to_list(2)
            if len(invoices)>1:raise HTTPException(409,'Nomor faktur ganda. Minta Owner memeriksa tagihan.')
            if invoices:
                if invoices[0]['amount']!=record['amount']:raise HTTPException(409,'Nominal faktur dan utang berbeda. Minta Owner memeriksa tagihan.')
                await db.supplier_invoices.update_one({'store_id':user['store_id'],'id':invoices[0]['id']},{'$set':{'status':status,'paid_amount':paid}},session=session)
        return {key:value for key,value in {**record,'paid_amount':paid,'status':status}.items() if key!='_id'}
    return await transactions.run_transaction(db,save)
