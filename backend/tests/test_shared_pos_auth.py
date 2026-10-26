"""Shared-account containment: isolated records and real HTTP auth dependencies."""
import asyncio
import os
from pathlib import Path
import sys
os.environ.setdefault("JWT_SECRET_KEY", "shared-pos-fixture-secret-at-least-thirty-two-bytes")
os.environ.setdefault("ENV", "test")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient
import auth

run = asyncio.run

@pytest.fixture
def fixture(monkeypatch):
    db = AsyncMongoMockClient().shared_pos_auth
    monkeypatch.setattr(auth, "get_db", lambda: db)
    run(db.stores.insert_many([
        {"id": "geraina-store", "module": "geraina", "owner_user_id": "owner"},
        {"id": "dapur-store", "module": "dapuros", "owner_user_id": "dapur-owner"},
    ]))
    run(db.users.insert_many([
        {"id": "owner", "role": "Owner", "store_id": "geraina-store", "plan": "business"},
        {"id": "cashier", "role": "Owner", "store_id": "geraina-store", "plan": "business", "credential_version": 2},
        {"id": "dapur-staff", "role": "Owner", "store_id": "dapur-store", "plan": "business", "credential_version": 2},
    ]))
    run(db.staff.insert_many([
        {"id": "staff-a", "user_id": "cashier", "store_id": "geraina-store", "role": "Cashier", "status": "Aktif"},
        {"id": "staff-b", "user_id": "dapur-staff", "store_id": "dapur-store", "role": "Cashier", "status": "Aktif"},
    ]))
    app = FastAPI()
    @app.get("/operational")
    async def operational(user=Depends(auth.get_current_user)):
        return {"role": user["role"], "store_id": user["store_id"]}
    @app.get("/billing")
    async def billing(user=Depends(auth.require_billing_admin)):
        return {"role": user["role"]}
    @app.get("/identity")
    async def identity(user=Depends(auth.get_identity)):
        return {"role": user["role"], "store_id": user.get("store_id")}
    return db, TestClient(app)

def headers(uid="cashier", module="dapuros", cv=2):
    return {"Authorization": "Bearer " + auth.create_access_token(uid, "ignored", "Owner", "fixture@example.invalid", cv), "X-DagangOS-Module": module}

@pytest.mark.parametrize("path", ["/operational", "/billing"])
def test_geraina_records_cannot_be_opened_by_forging_module(fixture, path):
    _, client = fixture
    assert client.get(path, headers=headers(module="geraina")).status_code == 409
    assert client.get(path, headers=headers()).status_code == 409

def test_membership_overrides_stale_owner_field_and_blocks_billing(fixture):
    _, client = fixture
    assert client.get("/operational", headers=headers("dapur-staff")).json()["role"] == "Cashier"
    assert client.get("/billing", headers=headers("dapur-staff")).status_code == 403

def test_existing_dapur_employee_does_not_require_a_geraina_credential_migration(fixture):
    db, client = fixture
    run(db.users.update_one({"id": "dapur-staff"}, {"$unset": {"credential_version": ""}}))
    assert client.get("/operational", headers=headers("dapur-staff", cv=0)).json()["role"] == "Cashier"

@pytest.mark.parametrize("change", [{"credential_version": 3}, {"status": "Non-Aktif"}, {"disabled": True}])
def test_reset_or_disabled_account_rejects_old_token(fixture, change):
    db, client = fixture
    run(db.users.update_one({"id": "cashier"}, {"$set": change}))
    assert client.get("/identity", headers=headers(module="geraina")).status_code == 401

def test_employee_cannot_activate_another_product_as_owner(fixture):
    _, client = fixture
    assert client.get("/identity", headers=headers()).status_code == 409
    assert client.get("/identity", headers=headers(module="geraina")).json()["role"] == "Cashier"

def test_true_owner_can_reach_cross_product_activation_without_operational_store(fixture):
    _, client = fixture
    h = headers("owner", cv=0)
    assert client.get("/identity", headers=h).json() == {"role": "Owner", "store_id": None}
    assert client.get("/operational", headers=h).status_code == 409
