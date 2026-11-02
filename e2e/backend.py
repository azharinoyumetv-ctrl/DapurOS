"""Real DapurOS app with isolated fixture controls. Never imported by production."""
import ipaddress
import os
import socket
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

assert os.environ.get('ENV') == 'test'
assert os.environ['MONGO_URL'].startswith('mongodb://127.0.0.1:')
assert os.environ['DB_NAME'].startswith('dapuros_e2e_')
assert len(os.environ['E2E_FIXTURE_KEY']) >= 32
# Do not import any credentials from the developer's production .env.
import dotenv
dotenv.load_dotenv = lambda *args, **kwargs: False
original_connect = socket.socket.connect
def local_connect(sock, address):
    if isinstance(address, tuple):
        try:
            permitted = address[0] == 'localhost' or ipaddress.ip_address(address[0]).is_loopback
        except ValueError:
            permitted = False
        if not permitted:
            raise ConnectionRefusedError('External network is disabled in the isolated E2E backend')
    return original_connect(sock, address)
socket.socket.connect = local_connect

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from server import app
from database import get_raw_db
from fastapi import Header, HTTPException, Request

async def fixture(request: Request, x_e2e_fixture: str = Header(default='')):
    if request.client.host not in ('127.0.0.1', '::1') or x_e2e_fixture != os.environ['E2E_FIXTURE_KEY']:
        raise HTTPException(404)
    assert get_raw_db().name == os.environ['DB_NAME']

@app.post('/__e2e/plan')
async def plan(request: Request, x_e2e_fixture: str = Header(default='')):
    await fixture(request, x_e2e_fixture)
    body = await request.json()
    assert body['plan'] in ('trial','expired','starter','pro','business')
    db = get_raw_db()
    store = await db.stores.find_one({'id': body['store_id'], 'module':'dapuros'})
    if not store:
        raise HTTPException(404)
    await db.stores.update_one({'id':store['id']}, {'$set':{'plan':body['plan'], 'trial_ends_at':(datetime.now(timezone.utc)+timedelta(days=14 if body['plan']=='trial' else -1)).isoformat()}})
    await db.users.update_one({'id':store['owner_user_id']}, {'$unset':{'subscriptions.dapuros':''}})
    return {'ok':True}

@app.post('/__e2e/reset')
async def reset(request: Request, x_e2e_fixture: str = Header(default='')):
    await fixture(request,x_e2e_fixture)
    db=get_raw_db()
    for collection in await db.list_collection_names():
        await db[collection].delete_many({})
    return {'ok':True}


@app.post('/__e2e/catalogue')
async def seed_catalogue(request:Request,x_e2e_fixture:str=Header(default='')):
    await fixture(request,x_e2e_fixture);body=await request.json();count=body.get('count',0)
    if type(count) is not int or not 1<=count<=2000:raise HTTPException(422)
    db=get_raw_db();store=await db.stores.find_one({'id':body.get('store_id'),'module':'dapuros'})
    if not store:raise HTTPException(404)
    rows=[{'id':f'e2e-menu-{i:04d}','store_id':store['id'],'name':f'E2E Menu {i:04d}','sku':f'E2E-{i:04d}','price':2000,'cost':1000,'stock':10,'unit':'pcs','category':'Menu','active':True,
           **({'module':'dapuros'} if i%2 else {})} for i in range(count)]
    rows.append({'id':'e2e-foreign','store_id':store['id'],'module':'geraina','name':'Foreign retail product','price':2000,'stock':10})
    await db.products.insert_many(rows)
    return {'ok':True,'count':count}
