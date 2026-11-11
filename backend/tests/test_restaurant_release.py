"""Real transaction/HTTP tests. Only a new random loopback database is permitted."""
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
import httpx
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import auth
import database
import routes_orders as orders
import routes_offline as offline
import routes_tables as tables
import routes_products as products
import routes_floors as floors
import routes_ingredients as ingredients
import routes_records as records
import routes_webhooks as webhooks

USER = {"id": "fixture-owner", "store_id": "fixture-store", "email": "fixture@example.invalid", "role": "Owner", "plan": "business", "current_module": "dapuros"}


@pytest_asyncio.fixture
async def shop(monkeypatch):
    config = json.loads((Path(__file__).resolve().parents[2] / "tmp/release-mongo.json").read_text())
    assert config["uri"].startswith("mongodb://127.0.0.1:")
    name = "dapuros_release_fixture_" + uuid4().hex
    client = AsyncIOMotorClient(config["uri"])
    db = client[name]
    await db.users.insert_one(USER.copy())
    await db.products.insert_many([
        {"id": "meal", "store_id": USER["store_id"], "name": "Resep", "price": 10000, "stock": 0, "recipe": [{"ingredient_id": "rice", "quantity": 15}], "category": "Makanan"},
        {"id": "coffee", "store_id": USER["store_id"], "name": "Kopi", "price": 5000, "stock": 20, "category": "Minuman"},
    ])
    await db.ingredients.insert_one({"id": "rice", "store_id": USER["store_id"], "name": "Beras", "stock": 100})
    for module in (database, orders, offline, tables, products, floors, ingredients, records, webhooks):
        monkeypatch.setattr(module, "get_db", lambda: db)
    app = FastAPI()
    for module in (orders, offline, tables, products, floors, ingredients, records, webhooks):
        app.include_router(module.router)
    app.dependency_overrides[auth.get_current_user] = lambda: USER.copy()
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://fixture.invalid") as http:
            yield db, http
    finally:
        assert name.startswith("dapuros_release_fixture_")
        await client.drop_database(name)
        client.close()


def sale(**extra):
    return {"items": [{"product_id": "meal", "name": "Resep", "price": 10000, "quantity": 2, "subtotal": 20000, "note": "Tanpa pedas"}], "payment_method": "cash", "cash_received": 30000, **extra}


@pytest.mark.asyncio
async def test_recipe_last_portion_cannot_be_sold_twice(shop):
    db, http = shop
    await db.products.update_one({"id": "meal"}, {"$set": {"recipe": [{"ingredient_id": "rice", "quantity": 0.1}]}})
    await db.ingredients.update_one({"id": "rice"}, {"$set": {"stock": 0.09999999999999998}})
    payload = sale(items=[{"product_id": "meal", "name": "Resep", "price": 10000, "quantity": 1, "subtotal": 10000}])
    responses = await asyncio.gather(
        http.post("/api/orders", json=payload, headers={"Idempotency-Key": "last-portion-left"}),
        http.post("/api/orders", json=payload, headers={"Idempotency-Key": "last-portion-right"}),
    )
    assert sorted(response.status_code for response in responses) == [200, 409]
    assert (await db.ingredients.find_one({"id": "rice"}))["stock"] == 0
    assert await db.orders.count_documents({}) == await db.kds_tickets.count_documents({}) == 1
    saved = next(response.json() for response in responses if response.is_success)
    for _ in range(2):
        assert (await http.post(f"/api/orders/{saved['id']}/void")).is_success
    assert (await db.ingredients.find_one({"id": "rice"}))["stock"] == 0.1


@pytest.mark.asyncio
async def test_split_complimentary_recipe_item_moves_quantity_and_void_restores_once(shop):
    db, http = shop
    await db.products.update_one({"id": "meal"}, {"$set": {"price": 0}})
    await db.tables.insert_one({"id": "table", "store_id": USER["store_id"], "label": "Meja 1", "status": "Seated"})
    await db.order_sessions.insert_one({"id": "session", "store_id": USER["store_id"], "table_id": "table", "status": "Active"})
    response = await http.post("/api/orders", json=sale(session_id="session", items=[
        {"product_id": "meal", "name": "Resep", "price": 0, "quantity": 2, "subtotal": 0},
    ]))
    assert response.is_success, response.text
    order = response.json()
    split = await http.post("/api/tables/table/split-bill", json={"type": "item", "items": [{"product_id": "meal", "quantity": 1}]})
    assert split.is_success, split.text
    part = split.json()["split_order"]
    source = await db.orders.find_one({"id": order["id"]})
    assert source["items"][0]["quantity"] == part["items"][0]["quantity"] == 1
    assert source["total"] == part["total"] == 0
    assert (await http.post(f"/api/orders/{part['id']}/void")).is_success
    assert (await db.ingredients.find_one({"id": "rice"}))["stock"] == 85
    assert (await http.post(f"/api/orders/{order['id']}/void")).is_success
    assert (await db.ingredients.find_one({"id": "rice"}))["stock"] == 100


@pytest.mark.asyncio
async def test_equal_split_preserves_cents_without_negative_parts(shop):
    db, http = shop
    await db.order_sessions.insert_one({"id": "session", "store_id": USER["store_id"], "table_id": "table", "status": "Active"})
    await db.orders.insert_one({"id": "order", "store_id": USER["store_id"], "session_id": "session",
                                "payment_status": "pending", "total": 0.02})
    split = await http.post("/api/tables/table/split-bill", json={"type": "equal", "ways": 4})
    assert split.is_success, split.text
    assert split.json()["amounts"] == [0.01, 0.01, 0, 0]


async def setup_xendit(db):
    await db.integrations.insert_one({'store_id': USER['store_id'],
        'xendit': {'is_active': True, 'secret_key': 'isolated', 'webhook_token': 'isolated-callback'}})
    await db.payments_config.insert_one({'store_id': USER['store_id'], 'va': {'is_active': True, 'provider': 'Xendit'}})


def callback(reference, total, completed=False):
    return {'event': 'payment_session.completed' if completed else 'payment_session.expired', 'data': {
        'reference_id': reference, 'payment_session_id': 'isolated-session', 'session_type': 'PAY',
        'currency': 'IDR', 'amount': total, 'status': 'COMPLETED' if completed else 'EXPIRED',
    }}


@pytest.mark.asyncio
async def test_table_gateway_serializes_checkout_and_changes_and_unlocks_on_verified_expiry(shop, monkeypatch):
    db, http = shop
    await setup_xendit(db)
    await db.tables.insert_one({'id': 'table', 'store_id': USER['store_id'], 'label': 'Meja 1', 'status': 'Seated'})
    await db.order_sessions.insert_one({'id': 'session', 'store_id': USER['store_id'], 'table_id': 'table', 'status': 'Active'})
    submitted = await http.post('/api/orders', json=sale(session_id='session', cash_received=None))
    assert submitted.status_code == 200, submitted.text
    order = submitted.json()
    create = AsyncMock(return_value={'gateway_checkout_url': 'https://checkout.example.invalid/pay', 'gateway_session_id': 'isolated-session'})
    monkeypatch.setattr(orders, 'create_merchant_checkout', create)
    path = '/api/tables/table/gateway-payment'
    body = {'payment_method': 'va', 'expected_session_id': 'session', 'expected_total': 23100}
    assert (await http.post(path, json={**body, 'expected_total': 22000})).status_code == 409
    assert (await http.post(path, json={**body, 'expected_session_id': 'old'})).status_code == 409
    left, right = await asyncio.gather(http.post(path, json=body), http.post(path, json=body))
    assert left.status_code == right.status_code == 200, (left.text, right.text)
    first = left.json()
    assert first['id'] == right.json()['id']
    assert create.await_count == 1
    assert (await http.post('/api/orders', json=sale(session_id='session', cash_received=None))).status_code == 409
    assert (await http.post('/api/tables/table/split-bill', json={'type': 'item', 'items': [{'product_id':'meal','quantity':1}]})).status_code == 409
    assert (await http.post(f"/api/orders/{order['id']}/void")).status_code == 409
    assert (await db.ingredients.find_one({'id': 'rice'}))['stock'] == 70
    auth_headers = {'x-callback-token': 'isolated-callback'}
    assert (await http.post('/api/webhooks/xendit', json=callback(first['reference'], 23100))).status_code == 401
    assert (await http.post('/api/webhooks/xendit', headers=auth_headers, json=callback(first['reference'], 23100))).is_success
    assert (await http.get(f"{path}/{first['id']}")).json()['payment_status'] == 'failed'
    assert (await db.order_sessions.find_one({'id': 'session'}))['status'] == 'Active'
    next_attempt = (await http.post(path, json=body)).json()
    assert next_attempt['id'] != first['id']
    assert (await http.post('/api/webhooks/xendit', headers=auth_headers, json=callback(first['reference'], 23100, True))).is_success
    assert (await db.orders.find_one({'id': order['id']}))['payment_status'] == 'pending'
    assert (await http.post('/api/webhooks/xendit', headers=auth_headers, json=callback(next_attempt['reference'], 23100, True))).is_success
    assert (await db.orders.find_one({'id': order['id']}))['payment_status'] == 'paid'
    assert (await db.tables.find_one({'id': 'table'}))['status'] == 'Vacant'
    assert await db.kds_tickets.count_documents({}) == 1


@pytest.mark.asyncio
async def test_takeaway_expiry_restores_recipe_inventory_and_cancels_kitchen_once(shop, monkeypatch):
    db, http = shop
    await setup_xendit(db)
    monkeypatch.setattr(orders, 'create_merchant_checkout',
        AsyncMock(return_value={'gateway_checkout_url': 'https://checkout.example.invalid/pay', 'gateway_session_id': 'isolated-session'}))
    response = await http.post('/api/orders', json=sale(payment_method='va', cash_received=None))
    assert response.status_code == 200, response.text
    charge = response.json()
    assert (await db.ingredients.find_one({'id': 'rice'}))['stock'] == 70
    assert await db.kds_tickets.count_documents({}) == 1
    for _ in range(2):
        response = await http.post('/api/webhooks/xendit', headers={'x-callback-token': 'isolated-callback'},
                                   json=callback(charge['gateway_reference'], 20000))
        assert response.is_success
    assert (await db.orders.find_one({'id': charge['id']}))['payment_status'] == 'failed'
    assert (await db.ingredients.find_one({'id': 'rice'}))['stock'] == 100
    assert (await db.products.find_one({'id': 'meal'}))['stock'] == 0
    assert await db.kds_tickets.count_documents({}) == 0


@pytest.mark.asyncio
async def test_manual_table_status_uses_merchant_server_and_rejects_wrong_amount(shop, monkeypatch):
    db, http = shop
    await setup_xendit(db)
    await db.tables.insert_one({'id': 'table', 'store_id': USER['store_id'], 'label': 'Meja 1', 'status': 'Seated'})
    await db.order_sessions.insert_one({'id': 'session', 'store_id': USER['store_id'], 'table_id': 'table', 'status': 'Active'})
    assert (await http.post('/api/orders', json=sale(session_id='session', cash_received=None))).is_success
    monkeypatch.setattr(orders, 'create_merchant_checkout',
        AsyncMock(return_value={'gateway_checkout_url': 'https://checkout.example.invalid/pay', 'gateway_session_id': 'isolated-session'}))
    charge = (await http.post('/api/tables/table/gateway-payment',
        json={'payment_method': 'va', 'expected_session_id': 'session', 'expected_total': 23100})).json()
    amount = 22000
    requests = []
    def reply(request):
        requests.append(request)
        assert str(request.url) == 'https://api.xendit.co/sessions/isolated-session'
        return httpx.Response(200, json={'payment_session_id': 'isolated-session', 'reference_id': charge['reference'],
            'session_type': 'PAY', 'currency': 'IDR', 'amount': amount, 'status': 'COMPLETED'})
    monkeypatch.setattr(httpx, 'AsyncClient', lambda **kwargs: AsyncClient(transport=httpx.MockTransport(reply), **kwargs))
    refresh = f"/api/tables/table/gateway-payment/{charge['id']}/refresh"
    assert (await http.post(refresh, json={'payment_status': 'paid'})).status_code == 409
    assert (await http.post(refresh)).json()['payment_status'] == 'pending'
    assert len(requests) == 1
    await db.checkout_attempts.update_one({'_id': charge['id']}, {'$unset': {'last_checked_at': ''}})
    amount = 23100
    assert (await http.post(refresh)).json()['payment_status'] == 'paid'
    assert (await db.tables.find_one({'id': 'table'}))['status'] == 'Vacant'


@pytest.mark.asyncio
async def test_recipe_cash_replay_and_snapshot_void(shop):
    db, http = shop
    first = await http.post("/api/orders", json=sale(), headers={"Idempotency-Key": "cash-attempt"})
    assert first.status_code == 200, first.text
    for _ in range(3):
        repeated = await http.post("/api/orders", json=sale(), headers={"Idempotency-Key": "cash-attempt"})
        assert repeated.json()["id"] == first.json()["id"]
    assert (await db.ingredients.find_one({"id": "rice"}))["stock"] == 70
    assert (await db.products.find_one({"id": "meal"}))["stock"] == 0
    assert await db.orders.count_documents({}) == await db.kds_tickets.count_documents({}) == 1
    await db.products.update_one({"id": "meal"}, {"$set": {"recipe": []}})
    for _ in range(2):
        assert (await http.post(f"/api/orders/{first.json()['id']}/void")).status_code == 200
    assert (await db.ingredients.find_one({"id": "rice"}))["stock"] == 100
    assert (await db.products.find_one({"id": "meal"}))["stock"] == 0


@pytest.mark.asyncio
async def test_dine_in_totals_pending_bill_and_kitchen_station(shop):
    db, http = shop
    await db.tables.insert_one({"id": "table", "store_id": USER["store_id"], "label": "Meja 1", "status": "Seated"})
    await db.order_sessions.insert_one({"id": "session", "store_id": USER["store_id"], "table_id": "table", "status": "Active"})
    response = await http.post("/api/orders", json=sale(session_id="session", cash_received=None))
    assert response.status_code == 200, response.text
    row = response.json()
    assert (row["total"], row["service_charge"], row["tax_pb1"], row["payment_status"]) == (23100, 1000, 2100, "pending")
    ticket = await db.kds_tickets.find_one({})
    assert ticket["station"] == "Kitchen" and ticket["table_label"] == "Meja 1" and ticket["items"][0]["notes"] == "Tanpa pedas"
    assert (await db.tables.find_one({"id": "table"}))["status"] == "Dining"
    settled = await http.post("/api/tables/table/checkout", json={"payment_method": "cash", "cash_received": 25000})
    assert settled.status_code == 200, settled.text
    assert (await db.tables.find_one({"id": "table"}))["status"] == "Vacant"
    assert (await db.orders.find_one({"id": row["id"]}))["payment_status"] == "paid"


@pytest.mark.asyncio
@pytest.mark.parametrize("change", [{"session_id": "other-store-session"}, {"payment_method": "credit_card"}, {"discount": 20001}])
async def test_rejected_checkout_rolls_back_stock_counter_and_kitchen(shop, change):
    db, http = shop
    response = await http.post("/api/orders", json=sale(**change))
    assert response.status_code in (400, 409, 422), response.text
    assert await db.orders.count_documents({}) == await db.kds_tickets.count_documents({}) == await db.counters.count_documents({}) == 0
    assert (await db.ingredients.find_one({"id": "rice"}))["stock"] == 100


@pytest.mark.asyncio
async def test_concurrent_offline_recipe_replays_commit_once(shop):
    db, http = shop
    payload = {**sale(), "expected_store_id": USER["store_id"], "expected_cashier_id": USER["id"], "client_order_id": str(uuid4()), "sold_at": datetime.now(timezone.utc).isoformat()}
    responses = await asyncio.gather(*(http.post("/api/offline/orders", json=payload) for _ in range(6)))
    assert all(r.status_code == 200 for r in responses), [r.text for r in responses]
    assert len({r.json()["id"] for r in responses}) == 1
    assert await db.orders.count_documents({}) == await db.kds_tickets.count_documents({}) == 1
    assert (await db.ingredients.find_one({"id": "rice"}))["stock"] == 70
    assert (await db.counters.find_one({}))["seq"] == 1


@pytest.mark.asyncio
async def test_offline_missing_recipe_and_wrong_cashier_keep_sale_uncommitted(shop):
    db, http = shop
    payload = {**sale(), "expected_store_id": USER["store_id"], "expected_cashier_id": "other", "client_order_id": str(uuid4()), "sold_at": datetime.now(timezone.utc).isoformat()}
    assert (await http.post("/api/offline/orders", json=payload)).status_code == 403
    payload["expected_cashier_id"] = USER["id"]
    await db.ingredients.delete_one({"id": "rice"})
    assert (await http.post("/api/offline/orders", json=payload)).status_code == 409
    assert await db.orders.count_documents({}) == await db.kds_tickets.count_documents({}) == await db.counters.count_documents({}) == 0


@pytest.mark.asyncio
async def test_split_replay_conserves_bill_and_recipe_snapshots(shop):
    db, http = shop
    await db.tables.insert_one({"id": "table", "store_id": USER["store_id"], "label": "Meja 1", "status": "Seated"})
    await db.order_sessions.insert_one({"id": "session", "store_id": USER["store_id"], "table_id": "table", "status": "Active"})
    original = (await http.post("/api/orders", json=sale(session_id="session", cash_received=None))).json()
    request = {"type": "item", "items": [{"product_id": "meal", "quantity": 1}]}
    response = await http.post("/api/tables/table/split-bill", json=request, headers={"Idempotency-Key": "split-once"})
    assert response.status_code == 200, response.text
    split = response.json()["split_order"]
    repeat = await http.post("/api/tables/table/split-bill", json=request, headers={"Idempotency-Key": "split-once"})
    assert repeat.json()["split_order"]["id"] == split["id"]
    remaining = await db.orders.find_one({"id": original["id"]})
    assert remaining["total"] + split["total"] == 23100
    assert remaining["service_charge"] + split["service_charge"] == 1000
    assert remaining["tax_pb1"] + split["tax_pb1"] == 2100
    assert split["items"][0]["ingredient_deductions"][0]["quantity"] == 15
    assert (await http.post("/api/tables/table/checkout", json={"payment_method": "cash"})).status_code == 409
    for _ in range(2):
        paid = await http.post(f"/api/tables/table/split-orders/{split['id']}/settle", json={"payment_method": "cash"})
        assert paid.status_code == 200, paid.text
    assert (await http.post("/api/tables/table/checkout", json={"payment_method": "cash", "expected_session_id": "session"})).status_code == 200
    assert (await db.ingredients.find_one({"id": "rice"}))["stock"] == 70


@pytest.mark.asyncio
async def test_invalid_split_and_unconfigured_settlement_leave_bill_unchanged(shop):
    db, http = shop
    await db.tables.insert_one({"id": "table", "store_id": USER["store_id"], "label": "Meja 1", "status": "Seated"})
    await db.order_sessions.insert_one({"id": "session", "store_id": USER["store_id"], "table_id": "table", "status": "Active"})
    original = (await http.post("/api/orders", json=sale(session_id="session", cash_received=None))).json()
    for body in ({"type": "item", "items": [{"product_id": "meal", "quantity": 3}]}, {"type": "equal", "ways": 1}):
        assert (await http.post("/api/tables/table/split-bill", json=body)).status_code in (409, 422)
    assert (await http.post("/api/tables/table/checkout", json={"payment_method": "ewallet"})).status_code == 400
    assert (await http.post("/api/tables/table/checkout", json={"payment_method": "qris_bank", "checked_in_bank": True, "received_amount": 23100})).status_code == 400
    assert (await http.post("/api/tables/table/checkout", json={"payment_method": "cash", "expected_session_id": "stale-session"})).status_code == 409
    assert await db.orders.count_documents({}) == 1
    assert (await db.orders.find_one({"id": original["id"]}))["total"] == 23100
    assert (await db.order_sessions.find_one({"id": "session"}))["status"] == "Active"


@pytest.mark.asyncio
async def test_catalogue_pages_keep_restaurant_fields_and_exclude_other_products(shop):
    db, http = shop
    await db.products.insert_many([{"id": f"page-{i:04d}", "module": "dapuros", "store_id": USER["store_id"], "name": f"Menu {i}", "price": 10000, "recipe": [{"ingredient_id": "rice", "quantity": 1}]} for i in range(503)])
    await db.products.insert_one({"id": "foreign", "module": "geraina", "store_id": USER["store_id"], "name": "Other product"})
    first = (await http.get("/api/products/catalogue")).json()
    # Two original unlabelled restaurant menus remain visible during upgrades.
    assert first["total"] == 505 and len(first["items"]) == 500
    final = (await http.get("/api/products/catalogue", params={"cursor": first["next_cursor"]})).json()
    assert len(final["items"]) == 5 and final["next_cursor"] is None
    rows=first['items']+final['items']
    assert all(row['recipe'] for row in rows if row['id'].startswith('page-'))
    assert {'meal','coffee'}.issubset({row['id'] for row in rows})
    assert 'foreign' not in {row['id'] for row in rows}
    assert len({row["id"] for row in rows}) == 505


@pytest.mark.asyncio
async def test_reading_empty_restaurant_setup_does_not_invent_stock_or_tables(shop):
    db, http = shop
    await db.ingredients.delete_many({})
    for resource in ("floors", "tables", "ingredients"):
        response = await http.get("/api/" + resource)
        assert response.status_code == 200 and response.json() == [], response.text
        assert await db[resource].count_documents({}) == 0


@pytest.mark.asyncio
async def test_cashier_cannot_change_recipes_inventory_or_table_configuration(shop, monkeypatch):
    db, http = shop
    monkeypatch.setitem(USER, "role", "Cashier")
    for path in ("/api/products", "/api/ingredients", "/api/floors", "/api/tables"):
        result = await http.post(path, json={"name": "Unauthorized fixture"})
        assert result.status_code == 403, (path, result.text)
    assert (await db.ingredients.find_one({"id": "rice"}))["stock"] == 100
