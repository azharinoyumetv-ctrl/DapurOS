"""Ingredients CRUD + seeding for DapurOS BOM."""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException

from database import get_db, utcnow
from models import Ingredient, IngredientCreate, IngredientUpdate
from auth import get_current_user

router = APIRouter(prefix="/api/ingredients", tags=["ingredients"])


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


@router.delete("/{ingredient_id}")
async def delete_ingredient(ingredient_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.ingredients.delete_one({"id": ingredient_id, "store_id": user["store_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bahan baku tidak ditemukan")
    return {"ok": True}
