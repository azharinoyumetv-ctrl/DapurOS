"""Failure injection against the real database, auth and unchanged erasure fence."""
from uuid import uuid4
import pytest
from e2e.test_websocket import shop
from database import get_raw_db
import inventory_service
import routes_ingredients
from erasure_guard import guard_key


def headers(account):return {'Authorization':'Bearer '+account['access_token'],'X-DagangOS-Module':'dapuros'}


def test_adjustment_audit_failure_rolls_back_stock_and_record(shop,monkeypatch):
    client,account=shop;auth=headers(account)
    product=client.post('/api/products',headers=auth,json={'name':'Rollback menu','price':1000,'stock':10}).json()
    async def fail(*args,**kwargs):raise RuntimeError('fixture ledger write failure')
    monkeypatch.setattr(inventory_service,'movement',fail)
    with pytest.raises(Exception):client.post('/api/products/stock-adjustments',headers=auth,json={'product_id':product['id'],'type':'sub','adjustment_qty':2,'reason':'Fixture rollback'})
    assert client.get('/api/products',headers=auth).json()[0]['stock']==10
    assert client.get('/api/products/stock-adjustments',headers=auth).json()==[]


def test_spoilage_audit_failure_rolls_back_stock_and_log(shop,monkeypatch):
    client,account=shop;auth=headers(account)
    ingredient=client.post('/api/ingredients',headers=auth,json={'name':'Rollback ingredient','stock':10,'unit':'g'}).json()
    async def fail(*args,**kwargs):raise RuntimeError('fixture spoilage write failure')
    monkeypatch.setattr(routes_ingredients,'movement',fail)
    with pytest.raises(Exception):client.post('/api/ingredients/'+ingredient['id']+'/spoilage',headers=auth,json={'quantity_lost':2,'reason':'spilled','request_id':str(uuid4())})
    assert client.get('/api/ingredients',headers=auth).json()[0]['stock']==10
    assert client.get('/api/ingredients/spoilage/logs',headers=auth).json()==[]


def test_legacy_menus_remain_visible_and_explicit_geraina_products_are_excluded(shop):
    client,account=shop;auth=headers(account);store=account['user']['store_id']
    async def seed():
        db=get_raw_db();assert db.name.startswith('dapuros_e2e_')
        await db.products.insert_many([{'id':'legacy','store_id':store,'name':'Own legacy menu','price':1000,'stock':10},
            {'id':'foreign','store_id':store,'module':'geraina','name':'Foreign retail product','price':1000,'stock':10}])
    client.portal.call(seed)
    for path in ('/api/products','/api/products/catalogue'):
        data=client.get(path,headers=auth).json();rows=data['items'] if isinstance(data,dict) else data
        assert [row['id'] for row in rows]==['legacy']
    assert client.put('/api/products/foreign',headers=auth,json={'price':1}).status_code==404
    assert client.get('/api/products/lookup?code=foreign',headers=auth).status_code==404


def test_public_qr_cannot_write_through_a_closed_store_fence(shop):
    client,account=shop;auth=headers(account);store=account['user']['store_id']
    floor=client.post('/api/floors',headers=auth,json={'name':'Fence floor'}).json()
    table=client.post('/api/tables',headers=auth,json={'floor_id':floor['id'],'label':'Fence table'}).json()
    client.post('/api/tables/'+table['id']+'/session',headers=auth)
    product=client.post('/api/products',headers=auth,json={'name':'Fence menu','stock':10,'price':1000}).json()
    url=client.post('/api/tables/'+table['id']+'/qr-link',headers=auth,json={'enabled':True}).json()['url']
    token=url.split('token=')[1]
    async def close():
        db=get_raw_db();assert db.name.startswith('dapuros_e2e_')
        await db.erasure_guards.update_one({'_id':guard_key('store',store)},{'$set':{'state':'closed'}},upsert=True)
    client.portal.call(close)
    response=client.post('/api/public/qr/'+token+'/orders',headers={'Idempotency-Key':str(uuid4())},json={'items':[{'product_id':product['id'],'quantity':1,'expected_price':1000}]})
    assert response.status_code==409,response.text
    async def counts():
        db=get_raw_db();return await db.orders.count_documents({'store_id':store}),(await db.products.find_one({'id':product['id']}))['stock']
    assert client.portal.call(counts)==(0,10)


def test_legacy_missing_cost_is_unknown_after_current_cost_changes(shop):
    client,account=shop;auth=headers(account);store=account['user']['store_id']
    from database import utcnow
    async def seed():
        db=get_raw_db();assert db.name.startswith('dapuros_e2e_')
        await db.products.insert_one({'id':'cost-product','store_id':store,'name':'Current menu','price':1000,'cost':900,'stock':10})
        await db.orders.insert_one({'id':str(uuid4()),'store_id':store,'payment_status':'paid','total':1000,'subtotal':1000,'discount':0,'created_at':utcnow().isoformat(),'items':[{'product_id':'cost-product','quantity':1,'price':1000,'subtotal':1000}]})
    client.portal.call(seed)
    report=client.get('/api/reports/profit',headers=auth).json()
    assert report['cost_complete'] is False and report['totals']['cogs'] is None and report['totals']['net_profit'] is None
    assert client.get('/api/orders/stats',headers=auth).json()['today_gross_profit'] is None


def test_offline_cash_shortage_is_retained_once_and_ingredients_remain_readable(shop):
    from database import utcnow
    client,account=shop;auth=headers(account)
    ingredient=client.post('/api/ingredients',headers=auth,json={'name':'Offline ingredient','stock':1,'unit':'g'}).json()
    product=client.post('/api/products',headers=auth,json={'name':'Offline recipe','price':1000,'cost':500,'stock':0,'recipe':[{'ingredient_id':ingredient['id'],'quantity':2}]}).json()
    body={'expected_store_id':account['user']['store_id'],'expected_cashier_id':account['user']['id'],'client_order_id':str(uuid4()),'sold_at':utcnow().isoformat(),'payment_method':'cash','cash_received':2000,
        'items':[{'product_id':product['id'],'name':product['name'],'price':1000,'quantity':1,'subtotal':1000,'unit_cost':500}]}
    for _ in range(2):
        result=client.post('/api/offline/orders',headers=auth,json=body);assert result.status_code==200,result.text
        assert any(row['reason']=='ingredient_stock_below_zero' for row in result.json()['inventory_warnings'])
    response=client.get('/api/ingredients',headers=auth);assert response.status_code==200,response.text
    assert response.json()[0]['stock']==-1
    fixed=client.put('/api/ingredients/'+ingredient['id'],headers=auth,json={'stock':0,'expected_stock':-1});assert fixed.status_code==200,fixed.text
    assert len(client.get('/api/orders',headers=auth).json())==1


def test_offline_counted_menu_shortage_remains_readable_and_can_be_corrected(shop):
    from database import utcnow
    client,account=shop;auth=headers(account)
    product=client.post('/api/products',headers=auth,json={'name':'Last offline menu','stock':1,'price':1000}).json()
    body={'expected_store_id':account['user']['store_id'],'expected_cashier_id':account['user']['id'],'client_order_id':str(uuid4()),'sold_at':utcnow().isoformat(),'payment_method':'cash','cash_received':3000,
        'items':[{'product_id':product['id'],'name':product['name'],'price':1000,'quantity':2,'subtotal':2000}]}
    for _ in range(2):
        result=client.post('/api/offline/orders',headers=auth,json=body);assert result.status_code==200,result.text
        assert any(row['reason']=='stock_below_zero' for row in result.json()['inventory_warnings'])
    response=client.get('/api/products',headers=auth);assert response.status_code==200,response.text
    assert response.json()[0]['stock']==-1
    fixed=client.put('/api/products/'+product['id'],headers=auth,json={'stock':0,'expected_stock':-1});assert fixed.status_code==200,fixed.text
    assert len(client.get('/api/orders',headers=auth).json())==1


@pytest.mark.parametrize('provider',['xendit','midtrans','stripe','doku','whatsapp'])
def test_payment_and_message_simulation_routes_are_absent_even_with_old_flags(shop,monkeypatch,provider):
    monkeypatch.setenv('ALLOW_WEBHOOK_SIMULATE','true')
    client,account=shop
    result=client.post('/api/webhooks/'+provider+'/simulate',params={'store_id':account['user']['store_id']},json={'status':'SUCCEEDED','transaction_status':'settlement'})
    assert result.status_code==404,result.text


@pytest.mark.parametrize('channel',['qris','ewallet'])
def test_old_mock_flag_never_creates_a_fake_payment(monkeypatch,channel):
    import asyncio
    from xendit_client import create_qris,create_ewallet_charge,PaymentNotConfiguredError
    monkeypatch.setenv('ALLOW_PAYMENT_MOCK','true')
    cfg={'is_active':False,'secret_key':'test'}
    with pytest.raises(PaymentNotConfiguredError):
        asyncio.run(create_qris(cfg,'NO-DEMO',1000) if channel=='qris' else create_ewallet_charge(cfg,'NO-DEMO',1000,'OVO'))


def test_old_edc_flag_cannot_approve_a_simulated_charge(monkeypatch):
    import asyncio
    from edc_provider import get_edc_provider
    monkeypatch.setenv('EDC_ALLOW_SIMULATOR','true')
    result=asyncio.run(get_edc_provider('simulator').charge(1000,'NO-DEMO'))
    assert result.success is False and result.transaction_id is None


def test_manual_mark_paid_cannot_turn_a_pending_table_order_into_a_paid_order(shop):
    client,account=shop;auth=headers(account)
    floor=client.post('/api/floors',headers=auth,json={'name':'No demo floor'}).json()
    table=client.post('/api/tables',headers=auth,json={'floor_id':floor['id'],'label':'No demo table'}).json()
    session=client.post('/api/tables/'+table['id']+'/session',headers=auth).json()
    product=client.post('/api/products',headers=auth,json={'name':'No demo menu','stock':2,'price':1000}).json()
    result=client.post('/api/orders',headers=auth,json={'session_id':session['id'],'payment_method':'cash','items':[{'product_id':product['id'],'name':product['name'],'quantity':1,'price':1000,'subtotal':1000}]})
    assert result.status_code==200,result.text
    order=result.json();assert order['payment_status']=='pending'
    assert client.post('/api/orders/'+order['id']+'/mark-paid',headers=auth).status_code==404
    assert client.get('/api/orders/'+order['id'],headers=auth).json()['payment_status']=='pending'


def test_inbound_messages_exclude_historical_simulations_without_erasing_records(shop):
    client,account=shop;auth=headers(account);store=account['user']['store_id']
    async def seed():
        db=get_raw_db();assert db.name.startswith('dapuros_e2e_')
        await db.whatsapp_inbound.insert_many([{'store_id':store,'payload':{'text':'Real inbound'},'received_at':'2026-10-30T00:00:00+00:00'},
            {'store_id':store,'_simulated':True,'payload':{'text':'Old simulated message'},'received_at':'2026-10-30T00:01:00+00:00'}])
    client.portal.call(seed)
    result=client.get('/api/webhooks/whatsapp/inbound',headers=auth);assert result.status_code==200,result.text
    assert len(result.json())==1 and result.json()[0]['payload']['text']=='Real inbound'
