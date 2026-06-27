"""Kitchen Display System (KDS) routes for DapurOS."""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Body, Query

from database import get_db, utcnow
from models import KdsTicket
from auth import get_current_user
from routes_tables import notify_clients

router = APIRouter(prefix="/api/kds", tags=["kds"])


def _strip_id(d: dict) -> dict:
    if d:
        d.pop("_id", None)
    return d


@router.get("", response_model=List[KdsTicket])
async def list_kds_tickets(
    station: Optional[str] = Query(None),
    user: dict = Depends(get_current_user)
):
    db = get_db()
    flt = {"store_id": user["store_id"]}
    if station:
        flt["station"] = station
        
    cursor = db.kds_tickets.find(flt, {"_id": 0}).sort("created_at", 1)
    tickets = await cursor.to_list(length=100)
    
    # Calculate elapsed time dynamically
    for t in tickets:
        # Time calculations (dummy time elapsed or based on created_at)
        from datetime import datetime, timezone
        try:
            created = datetime.fromisoformat(t["created_at"])
            delta = datetime.now(timezone.utc) - created
            mins = int(delta.total_seconds() / 60)
            if mins <= 0:
                t["time_elapsed"] = "Baru saja"
            else:
                t["time_elapsed"] = f"{mins} mnt lalu"
        except Exception:
            t["time_elapsed"] = "Baru saja"
            
    return tickets


@router.put("/{ticket_id}/status")
async def update_ticket_status(
    ticket_id: str,
    status: str = Body(..., embed=True), # Pending | Cooking | Ready | Served
    user: dict = Depends(get_current_user)
):
    db = get_db()
    ticket = await db.kds_tickets.find_one({"id": ticket_id, "store_id": user["store_id"]})
    if not ticket:
        raise HTTPException(status_code=404, detail="Tiket KDS tidak ditemukan")
        
    if status == "Served":
        # Remove / Archive the ticket when served
        await db.kds_tickets.delete_one({"id": ticket_id, "store_id": user["store_id"]})
        await notify_clients(user["store_id"])
        return {"ok": True, "status": "Served"}
        
    # Update item status inside the ticket
    updated_items = []
    for it in ticket.get("items", []):
        it["status"] = status
        updated_items.append(it)
        
    await db.kds_tickets.update_one(
        {"id": ticket_id, "store_id": user["store_id"]},
        {"$set": {
            "items": updated_items,
            "updated_at": utcnow().isoformat()
        }}
    )
    
    await notify_clients(user["store_id"])
    return {"ok": True, "status": status}
