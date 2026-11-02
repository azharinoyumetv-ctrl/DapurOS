from permissions import require_permission
"""Ingredients CRUD + seeding for DapurOS BOM + Spoilage Log."""
import uuid
import hashlib
import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException

from database import get_db, utcnow
from models import (
    Ingredient, IngredientCreate, IngredientUpdate,
    SpoilageCreate, SpoilageLog, SPOILAGE_REASONS, SPOILAGE_REASON_ALIASES,
)
from auth import get_current_user
from plan_limits import require_plan
import transactions
import ingredient_store
from stock_ledger import movement
from erasure_guard import session_context

router = APIRouter(prefix="/api/ingredients", tags=["ingredients"])


async def _notify_stock(store_id: str):
    """Broadcast pembaruan stok ke seluruh klien WebSocket toko."""
    try:
        from server import ws_manager
        await ws_manager.broadcast(store_id, {"type": "STOCK_UPDATE"})
    except Exception:
        pass


def _strip_id(d: dict) -> dict:
    d.pop("_id", None)
    return d


@router.get("", response_model=List[Ingredient], dependencies=[Depends(require_permission('inventory.read'))])
async def list_ingredients(user: dict = Depends(require_plan("pro"))):
    db = get_db()
    flt = {"store_id": user["store_id"]}
    cursor = db.ingredients.find(flt, {"_id": 0}).sort("name", 1)
    return await cursor.to_list(length=200)


@router.post("", response_model=Ingredient, dependencies=[Depends(require_permission('inventory.write'))])
async def create_ingredient(payload: IngredientCreate, user: dict = Depends(require_plan("pro"))):
    db = get_db()
    return await transactions.run_transaction(db,lambda session:ingredient_store.save(db,user,payload.model_dump(),session))


@router.put("/{ingredient_id}", response_model=Ingredient, dependencies=[Depends(require_permission('inventory.write'))])
async def update_ingredient(ingredient_id: str, payload: IngredientUpdate, user: dict = Depends(require_plan("pro"))):
    db = get_db()
    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None and k!='expected_stock'}
    if not update:
        raise HTTPException(status_code=400, detail="Tidak ada perubahan data")
    
    res=await transactions.run_transaction(db,lambda session:ingredient_store.save(db,user,update,session,ingredient_id,payload.expected_stock))
    return res


@router.get("/spoilage/logs", response_model=List[SpoilageLog], dependencies=[Depends(require_permission('inventory.read'))])
async def list_spoilage_logs(user: dict = Depends(require_plan("pro"))):
    """Riwayat pencatatan bahan terbuang / rusak (Spoilage Log)."""
    db = get_db()
    cursor = db.spoilage_logs.find(
        {"store_id": user["store_id"]}, {"_id": 0}
    ).sort("created_at", -1)
    return await cursor.to_list(length=200)


@router.get("/spoilage/reasons", dependencies=[Depends(require_permission('inventory.read'))])
async def list_spoilage_reasons(user: dict = Depends(require_plan("pro"))):
    """Daftar alasan resmi pembuangan bahan baku.

    NOTE: this endpoint had no auth dependency at all before this -- anyone could hit it
    unauthenticated. It's static reference data, low risk, but gating it to match its sibling
    ingredients endpoints closes an unintentional gap rather than leaving one open by oversight."""
    return {"reasons": SPOILAGE_REASONS}


@router.post("/{ingredient_id}/spoilage", response_model=SpoilageLog, dependencies=[Depends(require_permission('inventory.write'))])
async def log_spoilage(ingredient_id: str, payload: SpoilageCreate, user: dict = Depends(require_plan("pro"))):
    # All guarded writes reuse the transaction context, including the audit log.
    result=await transactions.run_transaction(get_db(),lambda session:_log_spoilage(ingredient_id,payload,user))
    await _notify_stock(user['store_id'])
    return result


async def _log_spoilage(ingredient_id, payload, user):
    """Catat bahan terbuang: potong stok secara atomik + simpan log audit."""
    db = get_db()

    # Normalisasi alasan (terima alias bahasa Inggris lama)
    reason = SPOILAGE_REASON_ALIASES.get(payload.reason.strip().lower(), payload.reason)
    if reason not in SPOILAGE_REASONS:
        raise HTTPException(
            status_code=400,
            detail=f"Alasan tidak valid. Pilihan resmi: {', '.join(SPOILAGE_REASONS)}",
        )

    request_hash=hashlib.sha256(json.dumps({'ingredient':ingredient_id,'qty':payload.quantity_lost,'reason':reason,'notes':payload.notes,'actor':user['id']},sort_keys=True).encode()).hexdigest()
    identifier=user['store_id']+':spoilage:'+hashlib.sha256((payload.request_id or str(uuid.uuid4())).encode()).hexdigest()
    prior=await db.spoilage_logs.find_one({'_id':identifier},session=session_context.get())
    if prior:
        if prior.get('request_hash')!=request_hash:raise HTTPException(409,'Referensi bahan terbuang sudah digunakan untuk data berbeda.')
        return {key:value for key,value in prior.items() if key not in ('_id','request_hash')}

    # Potong stok secara atomik — hanya jika stok mencukupi
    ing = await db.ingredients.find_one_and_update(
        {
            "id": ingredient_id,
            "store_id": user["store_id"],
            "stock": {"$gte": payload.quantity_lost},
        },
        {
            "$inc": {"stock": -payload.quantity_lost},
            "$set": {"updated_at": utcnow().isoformat()},
        },
        return_document=True,
        projection={"_id": 0},
    )
    if not ing:
        exists = await db.ingredients.find_one({"id": ingredient_id, "store_id": user["store_id"]})
        if not exists:
            raise HTTPException(status_code=404, detail="Bahan baku tidak ditemukan")
        raise HTTPException(status_code=400, detail="Stok tidak mencukupi untuk jumlah yang dibuang")

    log = {
        '_id':identifier,'request_hash':request_hash,
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "ingredient_id": ingredient_id,
        "ingredient_name": ing.get("name", "-"),
        "unit": ing.get("unit", "-"),
        "quantity_lost": payload.quantity_lost,
        "reason": reason,
        "notes": payload.notes,
        "created_by": user.get("email"),
        "created_at": utcnow().isoformat(),
    }
    await db.spoilage_logs.insert_one(dict(log))
    # The quantity and audit event commit together with the stock decrement.
    await movement(db,session_context.get(),identifier=identifier,store_id=user['store_id'],product_id=ingredient_id,name=ing['name'],quantity=-payload.quantity_lost,reference='WASTE-'+log['id'][:8].upper(),kind='ingredient_spoilage',actor=user['id'],at=log['created_at'])
    return {key:value for key,value in log.items() if key not in ('_id','request_hash')}


@router.delete("/{ingredient_id}", dependencies=[Depends(require_permission('inventory.write'))])
async def delete_ingredient(ingredient_id: str, user: dict = Depends(require_plan("pro"))):
    db = get_db()
    await transactions.run_transaction(db,lambda session:ingredient_store.remove(db,user,ingredient_id,session))
    return {"ok": True}
