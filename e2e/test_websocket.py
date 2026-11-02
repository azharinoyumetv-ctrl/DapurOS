"""Actual ASGI socket authentication; uses only the runner's disposable database."""
import os
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from e2e.backend import app


@pytest.fixture
def shop():
    async def loopback_app(scope,receive,send):
        if scope['type'] in ('http','websocket'):scope={**scope,'client':('127.0.0.1',50000)}
        await app(scope,receive,send)
    with TestClient(loopback_app) as client:
        response=client.post('/api/auth/register',json={'store_name':'Socket E2E','email':f'socket-{uuid4().hex}@example.com','password':'Socket-local-only-12345'},headers={'X-DagangOS-Module':'dapuros'})
        assert response.status_code==200, response.text
        yield client,response.json()


def test_owner_socket_authentication_and_heartbeat(shop):
    client,account=shop
    with client.websocket_connect('/api/ws/'+account['user']['store_id']) as ws:
        ws.send_json({'type':'AUTH','token':account['access_token']})
        assert ws.receive_json()=={'type':'AUTH_OK'}
        ws.send_text('PING')
        assert ws.receive_json()=={'type':'PONG'}


@pytest.mark.parametrize('target,token',[('own','invalid'),('another-store','valid')])
def test_invalid_identity_and_foreign_store_are_rejected(shop,target,token):
    client,account=shop
    store=account['user']['store_id'] if target=='own' else target
    with client.websocket_connect('/api/ws/'+store) as ws:
        ws.send_json({'type':'AUTH','token':account['access_token'] if token=='valid' else token})
        with pytest.raises(WebSocketDisconnect) as closed:ws.receive_json()
        assert closed.value.code==1008


def test_socket_revalidates_access_after_subscription_expiry(shop):
    client,account=shop
    with client.websocket_connect('/api/ws/'+account['user']['store_id']) as ws:
        ws.send_json({'type':'AUTH','token':account['access_token']})
        assert ws.receive_json()['type']=='AUTH_OK'
        response=client.post('/__e2e/plan',json={'store_id':account['user']['store_id'],'plan':'expired'},headers={'X-E2E-Fixture':os.environ['E2E_FIXTURE_KEY']})
        assert response.status_code==200,response.text
        ws.send_text('PING')
        with pytest.raises(WebSocketDisconnect) as closed:ws.receive_json()
        assert closed.value.code==1008
