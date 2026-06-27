"""Floors CRUD + seeding for DapurOS."""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException

from database import get_db, utcnow
from models import Floor, FloorCreate, FloorUpdate
from auth import get_current_user

router = APIRouter(prefix="/api/floors", tags=["floors"])


def _strip_id(d: dict) -> dict:
    d.pop("_id", None)
    return d


@router.get("", response_model=List[Floor])
async def list_floors(user: dict = Depends(get_current_user)):
    db = get_db()
    flt = {"store_id": user["store_id"]}
    count = await db.floors.count_documents(flt)
    
    # Auto-seed default floors if empty
    if count == 0:
        default_floors = [
            {"name": "Lantai 1 (Utama)", "level": 1},
            {"name": "Lantai 2 (VIP)", "level": 2},
            {"name": "Rooftop (Outdoor)", "level": 3},
        ]
        docs = []
        for fl in default_floors:
            docs.append({
                "id": str(uuid.uuid4()),
                "store_id": user["store_id"],
                "created_at": utcnow().isoformat(),
                "updated_at": utcnow().isoformat(),
                **fl
            })
        await db.floors.insert_many(docs)
    
    cursor = db.floors.find(flt, {"_id": 0}).sort("level", 1)
    return await cursor.to_list(length=100)


@router.post("", response_model=Floor)
async def create_floor(payload: FloorCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    existing = await db.floors.find_one({"store_id": user["store_id"], "name": payload.name})
    if existing:
        raise HTTPException(status_code=400, detail="Lantai dengan nama tersebut sudah terdaftar")
    
    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "created_at": utcnow().isoformat(),
        "updated_at": utcnow().isoformat(),
        **payload.model_dump()
    }
    await db.floors.insert_one(doc)
    return _strip_id(doc)


@router.put("/{floor_id}", response_model=Floor)
async def update_floor(floor_id: str, payload: FloorUpdate, user: dict = Depends(get_current_user)):
    db = get_db()
    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Tidak ada perubahan data")
    
    update["updated_at"] = utcnow().isoformat()
    res = await db.floors.find_one_and_update(
        {"id": floor_id, "store_id": user["store_id"]},
        {"$set": update},
        return_document=True,
        projection={"_id": 0}
    )
    if not res:
        raise HTTPException(status_code=404, detail="Lantai tidak ditemukan")
    return res


@router.delete("/{floor_id}")
async def delete_floor(floor_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    
    # Delete the floor
    res = await db.floors.delete_one({"id": floor_id, "store_id": user["store_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lantai tidak ditemukan")
        
    # Cascade delete tables on this floor
    await db.tables.delete_many({"floor_id": floor_id, "store_id": user["store_id"]})
    
    return {"ok": True}
