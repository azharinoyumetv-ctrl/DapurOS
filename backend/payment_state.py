"""Monotonic provider settlement and customer benefits in one transaction."""
from datetime import datetime, timezone
import transactions
from sale_effects import apply_loyalty
from stock_ledger import sale_events
from restaurant_sales import restore, cancel_kitchen, notify_orders


async def provider_transition(db, scope, status, details):
    async def settle(session):
        updates = dict(details)
        order = await db.orders.find_one(scope, session=session)
        if not order or status == 'pending':
            return
        previous = order.get('payment_status')
        if previous in ('voided', 'refunded', 'failed') or (previous == 'paid' and status != 'refunded'):
            if status == 'paid' and previous != 'paid':
                await db.orders.update_one(scope, {'$set': {
                    'payment_exception': 'Notifikasi pembayaran diterima setelah transaksi ditutup. Owner harus memeriksa dana dan pengembalian di akun merchant.',
                    **updates}}, session=session)
            return
        at=datetime.now(timezone.utc).isoformat()
        if status in ('failed', 'voided') and order.get('inventory_applied') is not False:
            for line in order.get('items',[]):
                await restore(db, order['store_id'], line, session)
                await sale_events(db, session, order_id=order['id'], store_id=order['store_id'], line=line,
                    reference=order['order_no'], kind='payment_cancelled' if status=='voided' else 'payment_declined',
                    actor='payment_provider', at=at)
            await cancel_kitchen(db, order['store_id'], order, session)
            updates={**updates,'inventory_applied':False, 'inventory_void_ledger_version':1}
        order.update(payment_status=status, updated_at=at)
        await db.orders.update_one(scope, {'$set': {'payment_status':status, 'updated_at':order['updated_at'],'payment_initialization':'ready', **updates}}, session=session)
        await apply_loyalty(db, order, session, reverse=status == 'refunded')
        return order['store_id']
    store_id = await transactions.run_transaction(db, settle)
    if store_id:
        await notify_orders(store_id)
