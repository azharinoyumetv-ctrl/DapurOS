"""One provider payment for an existing table bill; no new sale or kitchen ticket."""
from types import SimpleNamespace
from urllib.parse import urlencode
from uuid import uuid4
from fastapi import HTTPException
from database import utcnow
from payment_options import payment_options, require_payment_method
from restaurant_billing import active_session, bill_rows, close_paid_table, money
from sale_effects import apply_loyalty
from transactions import run_transaction

GATEWAY_METHODS = ('ewallet', 'va', 'credit_card', 'doku', 'qris')
KIND = 'table_gateway'


def public_payment(row):
    return {'reference': row.get('gateway_reference') or row['order_no'], **{key: row[key] for key in (
        'id', 'total', 'payment_status', 'payment_initialization', 'payment_provider',
        'payment_method', 'gateway_checkout_url', 'doku_checkout_url',
        'xendit_checkout_url', 'xendit_qr_string', 'ewallet_channel',
    ) if key in row}}


async def find_payment(db, scope, session=None):
    return await db.checkout_attempts.find_one({**scope, 'kind': KIND}, session=session)


async def start_table_payment(db, user, table_id, method, expected, expected_total, channel):
    # Reuse the same merchant adapters and channel policy as takeaway.
    from routes_orders import initialize_gateway
    if method not in GATEWAY_METHODS or not expected or expected_total is None:
        raise HTTPException(400, 'Muat ulang tagihan meja dan pilih metode pembayaran yang tersedia.')
    store = user['store_id']

    async def prepare(session):
        active = await active_session(db, user, table_id, session, expected, allow_payment=True)
        if active.get('gateway_payment_id'):
            existing = await find_payment(db, {'_id': active['gateway_payment_id'], 'store_id': store}, session)
            if not existing:
                raise HTTPException(409, 'Status pembayaran belum tersedia. Jangan membuat pembayaran baru.')
            return existing, False
        policy = await payment_options(db, user)
        wallet = await require_payment_method(db, user, method, channel, options=policy)
        rows, total = await bill_rows(db, store, active['id'], session)
        if money(expected_total) != total:
            raise HTTPException(409, 'Tagihan berubah. Muat ulang sebelum menerima pembayaran.')
        if total <= 0 or total != total.to_integral_value():
            raise HTTPException(400, 'Gateway memerlukan tagihan positif dalam rupiah bulat. Pilih tunai jika tagihan memiliki pecahan.')
        identifier = str(uuid4())
        choice = policy['methods'].get(method, {})
        provider = choice.get('provider') or 'xendit'
        hosted = method in ('va', 'credit_card') or (method == 'ewallet' and provider != 'xendit')
        row = {'_id': identifier, 'id': identifier, 'kind': KIND, 'store_id': store, 'table_id': table_id,
               'session_id': active['id'], 'order_no': 'T' + uuid4().hex[:24], 'total': float(total),
               'order_id': rows[0]['id'], 'order_ids': sorted(order['id'] for order in rows), 'payment_provider': provider,
               'payment_method': method, 'payment_status': 'pending', 'payment_initialization': 'initializing',
               'cashier_id': user['id'], 'created_at': utcnow().isoformat(), 'ewallet_channel': wallet}
        row['return_url'] = 'https://dagangos.com/dapuros/app/pos?' + urlencode({'table': table_id, 'payment': identifier})
        if hosted:
            # DOKU card invoices allow at most 30 characters.
            row.update(gateway_reference=row['order_no'] if provider == 'doku' else identifier,
                       gateway_channels=[item['code'] for item in choice['channels']])
        if method == 'qris' or (method == 'ewallet' and not hosted):
            row['xendit_reference_id'] = row['order_no']
        if method == 'doku':
            row['doku_id'] = row['order_no']
        await db.checkout_attempts.insert_one(dict(row), session=session)
        await db.order_sessions.update_one({'_id': active['_id']}, {'$set': {'gateway_payment_id': identifier}}, session=session)
        return row, True

    row, created = await run_transaction(db, prepare)
    if not created:
        return public_payment(row)
    scope = {'_id': row['id'], 'store_id': store, 'payment_status': 'pending'}
    try:
        payload = SimpleNamespace(payment_method=method, ewallet_channel=row['ewallet_channel'],
                                  customer_name=None, customer_phone=None, customer_email=None)
        updated = await initialize_gateway(payload, user, db, dict(row))
        if not any(updated.get(key) for key in ('gateway_checkout_url', 'doku_checkout_url', 'xendit_checkout_url', 'xendit_qr_string')):
            raise ValueError('Provider did not return a payment action')
    except HTTPException as error:
        if error.status_code == 400 and not (error.headers or {}).get('X-Payment-Uncertain'):
            await transition_table_payment(db, row, 'failed', {'declined_at_setup': True})
            raise
        await db.checkout_attempts.update_one(scope, {'$set': {'payment_initialization': 'uncertain'}})
    except Exception:
        # The provider may already have accepted the payment. Keep the bill locked.
        await db.checkout_attempts.update_one(scope, {'$set': {'payment_initialization': 'uncertain'}})
    else:
        updates = {key: value for key, value in updated.items() if key.startswith(('xendit_', 'doku_', 'gateway_')) and not key.endswith('_raw')}
        await db.checkout_attempts.update_one(scope, {'$set': {**updates, 'payment_initialization': 'ready'}})
    return public_payment(await find_payment(db, {'_id': row['id'], 'store_id': store}))


async def transition_table_payment(db, payment, status, details):
    if status == 'pending':
        return
    scope = {'_id': payment['id'], 'store_id': payment['store_id'], 'kind': KIND}

    async def transition(session):
        row = await db.checkout_attempts.find_one(scope, session=session)
        if not row:
            return False
        previous = row['payment_status']
        at = utcnow().isoformat()
        if previous != 'pending':
            if previous == 'paid' and status == 'refunded':
                for order in await db.orders.find({'id': {'$in': row['order_ids']}, 'store_id': row['store_id'],
                        'table_gateway_id': row['id'], 'payment_status': 'paid'}, session=session).to_list(None):
                    await db.orders.update_one({'_id': order['_id']}, {'$set': {'payment_status': 'refunded', 'updated_at': at}}, session=session)
                    await apply_loyalty(db, order, session, reverse=True)
                await db.checkout_attempts.update_one(scope, {'$set': {'payment_status': 'refunded', 'updated_at': at}}, session=session)
            elif previous in ('failed', 'voided') and status == 'paid':
                await db.checkout_attempts.update_one(scope, {'$set': {'late_payment_at': at}}, session=session)
            return False
        active = await db.order_sessions.find_one({'id': row['session_id'], 'store_id': row['store_id'],
            'table_id': row['table_id'], 'gateway_payment_id': row['id'], 'status': 'Active'}, session=session)
        if not active:
            return False
        if status == 'paid':
            orders, total = await bill_rows(db, row['store_id'], active['id'], session)
            if sorted(order['id'] for order in orders) != row['order_ids'] or total != money(row['total']):
                # No payment should close a bill different from the one sent to the provider.
                await db.checkout_attempts.update_one(scope, {'$set': {'payment_initialization': 'uncertain'}}, session=session)
                return False
            updates = {'payment_status': 'paid', 'payment_method': row['payment_method'],
                'table_gateway_id': row['id'], 'payment_provider': row['payment_provider'], 'updated_at': at,
                'payment_confirmation': {'type': 'gateway', 'confirmed_at': at, 'reference': row['id']}}
            for order in orders:
                await db.orders.update_one({'_id': order['_id']}, {'$set': updates}, session=session)
                await apply_loyalty(db, {**order, **updates}, session)
            await close_paid_table(db, active, session)
        elif status in ('failed', 'voided'):
            await db.order_sessions.update_one({'_id': active['_id']}, {'$unset': {'gateway_payment_id': ''}}, session=session)
        else:
            return False
        # Do not store full gateway payloads, which may contain customer details.
        await db.checkout_attempts.update_one(scope, {'$set': {'payment_status': status, 'payment_initialization': 'ready',
            'state': 'settled' if status == 'paid' else 'failed',
            'updated_at': at, **({'declined_at_setup': True} if details.get('declined_at_setup') else {})}}, session=session)
        return True

    if await run_transaction(db, transition):
        from routes_tables import notify_clients
        await notify_clients(payment['store_id'])
