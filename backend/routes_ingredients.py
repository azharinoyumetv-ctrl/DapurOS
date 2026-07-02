"""Ingredients CRUD + seeding for DapurOS BOM + Spoilage Log."""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException

from database import get_db, utcnow
from models import (
    Ingredient, IngredientCreate, IngredientUpdate,
    SpoilageCreate, SpoilageLog, SPOILAGE_REASONS, SPOILAGE_REASON_ALIASES,
)
from auth import get_current_user

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


@router.get("", response_model=List[Ingredient])
async def list_ingredients(user: dict = Depends(get_current_user)):
    db = get_db()
    flt = {"store_id": user["store_id"]}
    count = await db.ingredients.count_documents(flt)
    
    # Auto-seed default F&B ingredients if empty
    if count == 0:
        default_ingredients = [
            {"name": "Biji Kopi Arabika", "stock": 1500.0, "safety_stock": 500.0, "unit": "g"},
            {"name": "Fresh Milk", "stock": 8000.0, "safety_stock": 2000.0, "unit": "ml"},
            {"name": "Saus Pizza Homemade", "stock": 2500.0, "safety_stock": 1000.0, "unit": "g"},
            {"name": "Keju Mozzarella", "stock": 1800.0, "safety_stock": 500.0, "unit": "g"},
            {"name": "Beef Pepperoni", "stock": 60.0, "safety_stock": 20.0, "unit": "pcs"},
            {"name": "Adonan Pizza Dough", "stock": 15.0, "safety_stock": 5.0, "unit": "pcs"},
            {"name": "Daun Mint Segar", "stock": 300.0, "safety_stock": 100.0, "unit": "g"},
            {"name": "Cup Plastik 16oz", "stock": 120.0, "safety_stock": 30.0, "unit": "pcs"},
        ]
        docs = []
        for ing in default_ingredients:
            docs.append({
                "id": str(uuid.uuid4()),
                "store_id": user["store_id"],
                "created_at": utcnow().isoformat(),
                "updated_at": utcnow().isoformat(),
                **ing
            })
        await db.ingredients.insert_many(docs)
    
    cursor = db.ingredients.find(flt, {"_id": 0}).sort("name", 1)
    return await cursor.to_list(length=200)


@router.post("", response_model=Ingredient)
async def create_ingredient(payload: IngredientCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    existing = await db.ingredients.find_one({"store_id": user["store_id"], "name": payload.name})
    if existing:
        raise HTTPException(status_code=400, detail="Bahan baku dengan nama tersebut sudah terdaftar")
    
    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "created_at": utcnow().isoformat(),
        "updated_at": utcnow().isoformat(),
        **payload.model_dump()
    }
    await db.ingredients.insert_one(doc)
    return _strip_id(doc)


@router.put("/{ingredient_id}", response_model=Ingredient)
async def update_ingredient(ingredient_id: str, payload: IngredientUpdate, user: dict = Depends(get_current_user)):
    db = get_db()
    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Tidak ada perubahan data")
    
    update["updated_at"] = utcnow().isoformat()
    res = await db.ingredients.find_one_and_update(
        {"id": ingredient_id, "store_id": user["store_id"]},
        {"$set": update},
        return_document=True,
        projection={"_id": 0}
    )
    if not res:
        raise HTTPException(status_code=404, detail="Bahan baku tidak ditemukan")
    return res


@router.get("/spoilage/logs", response_model=List[SpoilageLog])
async def list_spoilage_logs(user: dict = Depends(get_current_user)):
    """Riwayat pencatatan bahan terbuang / rusak (Spoilage Log)."""
    db = get_db()
    cursor = db.spoilage_logs.find(
        {"store_id": user["store_id"]}, {"_id": 0}
    ).sort("created_at", -1)
    return await cursor.to_list(length=200)


@router.get("/spoilage/reasons")
async def list_spoilage_reasons():
    """Daftar alasan resmi pembuangan bahan baku."""
    return {"reasons": SPOILAGE_REASONS}


@router.post("/{ingredient_id}/spoilage", response_model=SpoilageLog)
async def log_spoilage(ingredient_id: str, payload: SpoilageCreate, user: dict = Depends(get_current_user)):
    """Catat bahan terbuang: potong stok secara atomik + simpan log audit."""
    db = get_db()

    # Normalisasi alasan (terima alias bahasa Inggris lama)
    reason = SPOILAGE_REASON_ALIASES.get(payload.reason.strip().lower(), payload.reason)
    if reason not in SPOILAGE_REASONS:
        raise HTTPException(
            status_code=400,
            detail=f"Alasan tidak valid. Pilihan resmi: {', '.join(SPOILAGE_REASONS)}",
        )

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
    await _notify_stock(user["store_id"])
    return log


@router.delete("/{ingredient_id}")
async def delete_ingredient(ingredient_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.ingredients.delete_one({"id": ingredient_id, "store_id": user["store_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bahan baku tidak ditemukan")
    return {"ok": True}
