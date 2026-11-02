import math
import transactions
import customer_store
from permissions import require_permission
from debt_service import payment_status, update_payment
"""Customer CRM, Memberships, Loyalty Rules, and Debt Receivables/Payables routes."""
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from database import get_db, utcnow
from models import (
    Customer, CustomerBase, Membership, MembershipBase, LoyaltyRules,
    DebtReceivable, DebtReceivableCreate, DebtReceivableUpdate,
    DebtPayable, DebtPayableCreate, DebtPayableUpdate
)
from auth import get_current_user
from plan_limits import require_plan

router = APIRouter(tags=["customers_debt"])

# ---------- Customers (Pro-tier feature in DapurOS -- unlike GerainaOS, the "Pelanggan" nav
# parent itself is Pro here, see AppLayout.jsx minPlan) ----------
@router.get("/api/customers", response_model=List[Customer], dependencies=[Depends(require_permission('customers.read'))])
async def list_customers(user: dict = Depends(require_plan("pro"))):
    db = get_db()
    cursor = db.customers.find({"store_id": user["store_id"]}, {"_id": 0}).sort("name", 1)
    return await cursor.to_list(length=200)

@router.post("/api/customers", response_model=Customer, dependencies=[Depends(require_permission('customers.write'))])
async def create_customer(payload: CustomerBase, user: dict = Depends(require_plan("pro"))):
    db=get_db()
    return await transactions.run_transaction(db,lambda session:customer_store.save(db,payload,user,session))

@router.put("/api/customers/{cust_id}", response_model=Customer, dependencies=[Depends(require_permission('customers.write'))])
async def update_customer(cust_id: str, payload: CustomerBase, user: dict = Depends(require_plan("pro"))):
    db=get_db()
    return await transactions.run_transaction(db,lambda session:customer_store.save(db,payload,user,session,cust_id))

@router.delete("/api/customers/{cust_id}", dependencies=[Depends(require_permission('customers.manage'))])
async def delete_customer(cust_id: str, user: dict = Depends(require_plan("pro"))):
    db = get_db()
    res = await db.customers.delete_one({"id": cust_id, "store_id": user["store_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pelanggan tidak ditemukan")
    return {"ok": True}

# ---------- Memberships (Business-tier feature -- see AppLayout.jsx minPlan) ----------
@router.get("/api/customers/memberships", response_model=List[Membership], dependencies=[Depends(require_permission('customers.read'))])
async def list_memberships(user: dict = Depends(require_plan("business"))):
    db = get_db()
    cursor = db.memberships.find({"store_id": user["store_id"]}, {"_id": 0}).sort("min_points", 1)
    return await cursor.to_list(length=100)

@router.post("/api/customers/memberships", response_model=Membership, dependencies=[Depends(require_permission('customers.manage'))])
async def create_membership(payload: MembershipBase, user: dict = Depends(require_plan("business"))):
    if not payload.name.strip() or payload.min_points<0 or not math.isfinite(payload.discount_percent) or not 0<=payload.discount_percent<=100:raise HTTPException(422,'Nama, batas poin, atau diskon keanggotaan tidak valid.')
    db = get_db()
    existing = await db.memberships.find_one({"store_id": user["store_id"], "name": payload.name})
    if existing:
        raise HTTPException(status_code=400, detail="Membership tier sudah ada")
    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "name": payload.name,
        "min_points": payload.min_points,
        "discount_percent": payload.discount_percent,
        "description": payload.description
    }
    await db.memberships.insert_one(doc)
    doc.pop("_id", None)
    return doc

# ---------- Loyalty Rules (Business-tier feature -- see AppLayout.jsx minPlan) ----------
@router.get("/api/customers/loyalty", response_model=LoyaltyRules, dependencies=[Depends(require_permission('customers.read'))])
async def get_loyalty_rules(user: dict = Depends(require_plan("business"))):
    db = get_db()
    rules = await db.loyalty_rules.find_one({"store_id": user["store_id"]}, {"_id": 0})
    if not rules:
        # Return default rules
        return LoyaltyRules()
    return rules

@router.post("/api/customers/loyalty", response_model=LoyaltyRules, dependencies=[Depends(require_permission('customers.manage'))])
async def save_loyalty_rules(payload: LoyaltyRules, user: dict = Depends(require_plan("business"))):
    if not 1<=payload.conversion_rate<=1_000_000_000_000 or not 0<=payload.point_value<=1_000_000_000 or not 1<=payload.min_redeem_points<=1_000_000_000:raise HTTPException(422,'Aturan poin tidak valid. Nominal per poin dan batas penukaran harus lebih dari nol.')
    db = get_db()
    doc = payload.model_dump()
    doc["store_id"] = user["store_id"]
    await db.loyalty_rules.find_one_and_replace(
        {"store_id": user["store_id"]},
        doc,
        upsert=True
    )
    return payload

# ---------- Debt Receivables (Piutang) -- Pro-tier feature, see AppLayout.jsx minPlan ----------
@router.get("/api/debt/receivables", response_model=List[DebtReceivable], dependencies=[Depends(require_permission('customers.read'))])
async def list_receivables(user: dict = Depends(require_plan("pro"))):
    db = get_db()
    cursor = db.debt_receivables.find({"store_id": user["store_id"]}, {"_id": 0})
    return await cursor.to_list(length=100)

@router.post("/api/debt/receivables", response_model=DebtReceivable, dependencies=[Depends(require_permission('customers.write'))])
async def create_receivable(payload: DebtReceivableCreate, user: dict = Depends(require_plan("pro"))):
    db = get_db()
    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "customer_name": payload.customer_name,
        "phone": payload.phone,
        "order_no": payload.order_no,
        "amount": payload.amount,
        "paid_amount": payload.paid_amount,
        "due_date": payload.due_date,
        "status": payment_status(payload.amount,payload.paid_amount)
    }
    await db.debt_receivables.insert_one(doc)
    doc.pop("_id", None)
    return doc

@router.put("/api/debt/receivables/{receivable_id}", response_model=DebtReceivable, dependencies=[Depends(require_permission('customers.write'))])
async def update_receivable(receivable_id: str, payload: DebtReceivableUpdate, user: dict = Depends(require_plan("pro"))):
    """Record a payment/settlement against an existing receivable (partial or full).

    HISTORY: this endpoint didn't exist -- the frontend's 'Terima Bayar' button POSTed a
    client-computed {id, paid_amount, status} straight to the CREATE endpoint above, which
    ignores any 'id' in the payload, requires customer_name/order_no/due_date that weren't
    sent, and always inserts a brand-new row. So the button 422'd silently (no .catch() on
    the frontend) and no payment was ever actually recorded. This PUT is the real fix,
    mirroring GerainaOS's routes_customers.py."""
    db = get_db()
    return await update_payment(db,db.debt_receivables,receivable_id,payload,user)

# ---------- Debt Payables (Hutang) -- Pro-tier feature, see AppLayout.jsx minPlan ----------
@router.get("/api/debt/payables", response_model=List[DebtPayable], dependencies=[Depends(require_permission('customers.read'))])
async def list_payables(user: dict = Depends(require_plan("pro"))):
    db = get_db()
    cursor = db.debt_payables.find({"store_id": user["store_id"]}, {"_id": 0})
    return await cursor.to_list(length=100)

@router.post("/api/debt/payables", response_model=DebtPayable, dependencies=[Depends(require_permission('customers.write'))])
async def create_payable(payload: DebtPayableCreate, user: dict = Depends(require_plan("pro"))):
    db = get_db()
    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "supplier_name": payload.supplier_name,
        "invoice_no": payload.invoice_no,
        "amount": payload.amount,
        "paid_amount": payload.paid_amount,
        "due_date": payload.due_date,
        "status": payment_status(payload.amount,payload.paid_amount)
    }
    await db.debt_payables.insert_one(doc)
    doc.pop("_id", None)
    return doc

@router.put("/api/debt/payables/{payable_id}", response_model=DebtPayable, dependencies=[Depends(require_permission('customers.write'))])
async def update_payable(payable_id: str, payload: DebtPayableUpdate, user: dict = Depends(require_plan("pro"))):
    """Record a payment/settlement against an existing payable (partial or full). Same
    missing-endpoint bug as update_receivable above, fixed the same way."""
    db = get_db()
    return await update_payment(db,db.debt_payables,payable_id,payload,user)
