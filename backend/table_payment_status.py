"""Explicit server-to-server status checks when a merchant notification is delayed."""
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from urllib.parse import quote
import httpx
from fastapi import HTTPException
from database import utcnow
from doku_client import get_checkout_status
from table_payments import KIND, find_payment, transition_table_payment


def verified_status(row, reference, identity, amount, currency, status):
    try:
        value = Decimal(str(amount))
        if identity != reference or currency != 'IDR' or not value.is_finite() or value != Decimal(str(row['total'])):
            raise ValueError()
    except (InvalidOperation, ValueError, TypeError):
        raise HTTPException(409, 'Penyedia belum mengonfirmasi referensi dan nominal tagihan.') from None
    return status


async def check_provider(row, config):
    provider = row['payment_provider']
    if provider == 'doku':
        reference = row.get('gateway_reference') or row['order_no']
        data = await get_checkout_status(config, reference)
        order, transaction = data.get('order') or {}, data.get('transaction') or {}
        status = {'SUCCESS': 'paid', 'EXPIRED': 'failed', 'CANCEL': 'voided'}.get(transaction.get('status'), 'pending')
        return verified_status(row, reference, order.get('invoice_number'), order.get('amount'), order.get('currency', 'IDR'), status)
    if provider == 'midtrans':
        reference = row['gateway_reference']
        base = 'https://api.midtrans.com' if config.get('environment') == 'production' else 'https://api.sandbox.midtrans.com'
        async with httpx.AsyncClient(base_url=base, auth=httpx.BasicAuth(config['server_key'], ''), timeout=10) as client:
            response = await client.get('/v2/' + quote(reference, safe='') + '/status')
            response.raise_for_status()
            data = response.json()
        state = data.get('transaction_status')
        status = ('paid' if state == 'settlement' or (state == 'capture' and data.get('fraud_status') == 'accept') else
                  'failed' if state in ('deny', 'expire', 'cancel', 'failure') else 'pending')
        return verified_status(row, reference, data.get('order_id'), data.get('gross_amount'), data.get('currency', 'IDR'), status)
    if provider == 'xendit':
        hosted = bool(row.get('gateway_reference'))
        key = row.get('gateway_session_id' if hosted else 'xendit_id')
        if not key:
            raise HTTPException(409, 'ID pembayaran penyedia belum tersedia. Periksa akun merchant sebelum menerima pembayaran lain.')
        async with httpx.AsyncClient(base_url='https://api.xendit.co', auth=httpx.BasicAuth(config['secret_key'], ''), timeout=10) as client:
            response = await client.get(('/sessions/' if hosted else '/v3/payment_requests/') + quote(key, safe=''),
                                        headers={} if hosted else {'api-version': '2024-11-11'})
            response.raise_for_status()
            data = response.json()
        if data.get('payment_session_id' if hosted else 'payment_request_id') != key or (hosted and data.get('session_type') != 'PAY'):
            raise HTTPException(409, 'ID pembayaran penyedia tidak sesuai.')
        status = {('COMPLETED' if hosted else 'SUCCEEDED'): 'paid', 'EXPIRED': 'failed', 'CANCELED': 'voided'}.get(data.get('status'), 'pending')
        # A nonterminal failed attempt may be retried by the provider. Leave it
        # pending until the provider explicitly ends the request or sends a final notification.
        return verified_status(row, row['gateway_reference' if hosted else 'xendit_reference_id'],
            data.get('reference_id'), data.get('amount' if hosted else 'request_amount'), data.get('currency'), status)
    return 'pending'


async def refresh_table_payment(db, row):
    if row['payment_status'] != 'pending':
        return row
    now = utcnow()
    scope = {'_id': row['id'], 'store_id': row['store_id'], 'kind': KIND}
    claim = await db.checkout_attempts.update_one({**scope, 'payment_status': 'pending', '$or': [
        {'last_checked_at': {'$exists': False}}, {'last_checked_at': {'$lte': (now - timedelta(seconds=12)).isoformat()}}
    ]}, {'$set': {'last_checked_at': now.isoformat()}})
    if claim.modified_count:
        cfg = ((await db.integrations.find_one({'store_id': row['store_id']})) or {}).get(row['payment_provider']) or {}
        if cfg.get('is_active') is not True:
            raise HTTPException(409, 'Integrasi gateway toko tidak aktif. Periksa akun merchant.')
        try:
            status = await check_provider(row, cfg)
        except (httpx.HTTPError, ValueError, TypeError, KeyError, AttributeError):
            raise HTTPException(409, 'Gateway belum dapat mengonfirmasi status. Coba lagi atau periksa akun merchant.') from None
        await transition_table_payment(db, row, status, {})
    return await find_payment(db, scope)
