"""Tables, Sessions, and Split Billing routes for DapurOS."""
import uuid
from typing import List, Optional, Literal
from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel

from database import get_db, utcnow
from models import Table, TableCreate, TableUpdate, OrderSession, Order
from auth import get_current_user
from routes_orders import _calc

router = APIRouter(prefix="/api/tables", tags=["tables"])


class SplitRequest(BaseModel):
    type: Literal["equal", "item"]
    ways: Optional[int] = 2
    # For split-by-item: list of items to pull out and pay
    items: Optional[List[dict]] = None # [{"product_id": str, "quantity": int}]


def _strip_id(d: dict) -> dict:
    if d:
        d.pop("_id", None)
    return d


async def notify_clients(store_id: str):
    # Trigger broadcast if WebSocket is active in server (we will import and call it)
    try:
        from server import ws_manager
        await ws_manager.broadcast(store_id, {"type": "TABLE_UPDATE"})
    except Exception:
        pass


@router.get("", response_model=List[Table])
async def list_tables(floor_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    db = get_db()
    flt = {"store_id": user["store_id"]}
    if floor_id:
        flt["floor_id"] = floor_id
        
    count = await db.tables.count_documents({"store_id": user["store_id"]})
    
    # Auto-seed default tables if empty
    if count == 0:
        floors = await db.floors.find({"store_id": user["store_id"]}).to_list(length=10)
        f1 = next((f for f in floors if "Lantai 1" in f["name"]), None)
        f2 = next((f for f in floors if "Lantai 2" in f["name"]), None)
        f3 = next((f for f in floors if "Rooftop" in f["name"]), None)
        
        docs = []
        if f1:
            # Floor 1
            docs.append({"floor_id": f1["id"], "label": "Meja 01", "capacity": 2, "status": "Vacant", "x_coordinate": 10, "y_coordinate": 15, "width": 20, "height": 20, "shape": "circle"})
            docs.append({"floor_id": f1["id"], "label": "Meja 02", "capacity": 4, "status": "Vacant", "x_coordinate": 40, "y_coordinate": 15, "width": 24, "height": 20, "shape": "rectangle"})
            docs.append({"floor_id": f1["id"], "label": "Meja 03", "capacity": 4, "status": "Vacant", "x_coordinate": 70, "y_coordinate": 15, "width": 24, "height": 20, "shape": "rectangle"})
            docs.append({"floor_id": f1["id"], "label": "Meja 04", "capacity": 2, "status": "Vacant", "x_coordinate": 10, "y_coordinate": 55, "width": 20, "height": 20, "shape": "circle"})
            docs.append({"floor_id": f1["id"], "label": "Meja 05", "capacity": 6, "status": "Vacant", "x_coordinate": 40, "y_coordinate": 50, "width": 28, "height": 24, "shape": "rectangle"})
        if f2:
            # Floor 2
            docs.append({"floor_id": f2["id"], "label": "VIP Sofa A", "capacity": 8, "status": "Vacant", "x_coordinate": 15, "y_coordinate": 30, "width": 32, "height": 24, "shape": "rectangle"})
            docs.append({"floor_id": f2["id"], "label": "VIP Sofa B", "capacity": 8, "status": "Vacant", "x_coordinate": 60, "y_coordinate": 30, "width": 32, "height": 24, "shape": "rectangle"})
        if f3:
            # Floor 3 (Rooftop)
            docs.append({"floor_id": f3["id"], "label": "Outdoor 01", "capacity": 2, "status": "Vacant", "x_coordinate": 10, "y_coordinate": 20, "width": 20, "height": 20, "shape": "circle"})
            docs.append({"floor_id": f3["id"], "label": "Outdoor 02", "capacity": 4, "status": "Vacant", "x_coordinate": 40, "y_coordinate": 20, "width": 20, "height": 20, "shape": "circle"})
            docs.append({"floor_id": f3["id"], "label": "Outdoor 03", "capacity": 2, "status": "Vacant", "x_coordinate": 70, "y_coordinate": 20, "width": 20, "height": 20, "shape": "circle"})
            
        inserted_docs = []
        for t in docs:
            inserted_docs.append({
                "id": str(uuid.uuid4()),
                "store_id": user["store_id"],
                "created_at": utcnow().isoformat(),
                "updated_at": utcnow().isoformat(),
                **t
            })
        if inserted_docs:
            await db.tables.insert_many(inserted_docs)
            
    cursor = db.tables.find(flt, {"_id": 0}).sort("label", 1)
    return await cursor.to_list(length=200)


@router.post("", response_model=Table)
async def create_table(payload: TableCreate, user: dict = Depends(get_current_user)):
    db = get_db()
    existing = await db.tables.find_one({"store_id": user["store_id"], "floor_id": payload.floor_id, "label": payload.label})
    if existing:
        raise HTTPException(status_code=400, detail="Meja dengan label tersebut sudah ada di lantai ini")
    
    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "created_at": utcnow().isoformat(),
        "updated_at": utcnow().isoformat(),
        **payload.model_dump()
    }
    await db.tables.insert_one(doc)
    await notify_clients(user["store_id"])
    return _strip_id(doc)


@router.put("/{table_id}", response_model=Table)
async def update_table(table_id: str, payload: TableUpdate, user: dict = Depends(get_current_user)):
    db = get_db()
    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Tidak ada perubahan data")
    
    update["updated_at"] = utcnow().isoformat()
    res = await db.tables.find_one_and_update(
        {"id": table_id, "store_id": user["store_id"]},
        {"$set": update},
        return_document=True,
        projection={"_id": 0}
    )
    if not res:
        raise HTTPException(status_code=404, detail="Meja tidak ditemukan")
    await notify_clients(user["store_id"])
    return res


@router.delete("/{table_id}")
async def delete_table(table_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.tables.delete_one({"id": table_id, "store_id": user["store_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Meja tidak ditemukan")
    await notify_clients(user["store_id"])
    return {"ok": True}


# ---------- Dining Sessions ----------

@router.post("/{table_id}/session", response_model=OrderSession)
async def open_session(table_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    table = await db.tables.find_one({"id": table_id, "store_id": user["store_id"]})
    if not table:
        raise HTTPException(status_code=404, detail="Meja tidak ditemukan")
    
    # Check if there is an active session already
    active = await db.order_sessions.find_one({"table_id": table_id, "store_id": user["store_id"], "status": "Active"})
    if active:
        return _strip_id(active)
    
    session_id = str(uuid.uuid4())
    doc = {
        "id": session_id,
        "table_id": table_id,
        "store_id": user["store_id"],
        "opened_at": utcnow().isoformat(),
        "closed_at": None,
        "status": "Active"
    }
    await db.order_sessions.insert_one(doc)
    
    # Update table status to Seated
    await db.tables.update_one(
        {"id": table_id, "store_id": user["store_id"]},
        {"$set": {"status": "Seated", "updated_at": utcnow().isoformat()}}
    )
    await notify_clients(user["store_id"])
    return _strip_id(doc)


@router.get("/{table_id}/session")
async def get_active_session_bill(table_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    session = await db.order_sessions.find_one({"table_id": table_id, "store_id": user["store_id"], "status": "Active"})
    if not session:
        raise HTTPException(status_code=404, detail="Tidak ada sesi aktif di meja ini")
    
    # Find all orders in this session
    orders = await db.orders.find({"session_id": session["id"], "store_id": user["store_id"]}, {"_id": 0}).to_list(length=100)
    
    subtotal = 0
    discount = 0
    items_summary = []
    
    for o in orders:
        subtotal += o.get("subtotal", 0)
        discount += o.get("discount", 0)
        items_summary.extend(o.get("items", []))
        
    # Recalculate F&B service charge (5%) and tax_pb1 (10% applied on subtotal + service)
    base_amount = max(0, subtotal - discount)
    service_charge = round(base_amount * 0.05, 2)
    tax_pb1 = round((base_amount + service_charge) * 0.10, 2)
    grand_total = base_amount + service_charge + tax_pb1
    
    return {
        "session": _strip_id(session),
        "orders": orders,
        "items": items_summary,
        "subtotal": subtotal,
        "discount": discount,
        "service_charge": service_charge,
        "tax_pb1": tax_pb1,
        "grand_total": grand_total
    }


@router.post("/{table_id}/checkout")
async def settle_session(
    table_id: str,
    payment_method: str = Body(..., embed=True),
    cash_received: Optional[float] = Body(None, embed=True),
    user: dict = Depends(get_current_user)
):
    db = get_db()
    session = await db.order_sessions.find_one({"table_id": table_id, "store_id": user["store_id"], "status": "Active"})
    if not session:
        raise HTTPException(status_code=404, detail="Sesi aktif tidak ditemukan")
        
    # Get active session orders
    orders = await db.orders.find({"session_id": session["id"], "store_id": user["store_id"]}).to_list(length=100)
    
    # Mark all orders as paid
    order_ids = [o["id"] for o in orders]
    await db.orders.update_many(
        {"id": {"$in": order_ids}, "store_id": user["store_id"]},
        {"$set": {"payment_status": "paid", "payment_method": payment_method, "updated_at": utcnow().isoformat()}}
    )
    
    # Close session
    await db.order_sessions.update_one(
        {"id": session["id"], "store_id": user["store_id"]},
        {"$set": {"status": "Paid", "closed_at": utcnow().isoformat()}}
    )
    
    # Set table to Vacant
    await db.tables.update_one(
        {"id": table_id, "store_id": user["store_id"]},
        {"$set": {"status": "Vacant", "updated_at": utcnow().isoformat()}}
    )
    
    await notify_clients(user["store_id"])
    return {"ok": True, "session_id": session["id"]}


@router.post("/{table_id}/split-bill")
async def split_bill(table_id: str, req: SplitRequest, user: dict = Depends(get_current_user)):
    db = get_db()
    session = await db.order_sessions.find_one({"table_id": table_id, "store_id": user["store_id"], "status": "Active"})
    if not session:
        raise HTTPException(status_code=404, detail="Sesi aktif tidak ditemukan")
        
    bill = await get_active_session_bill(table_id, user)
    
    if req.type == "equal":
        ways = req.ways or 2
        amount = round(bill["grand_total"] / ways, 2)
        return {"type": "equal", "ways": ways, "amount_per_person": amount}
        
    elif req.type == "item":
        # Pull specified items from original orders, create a separate unpaid/paid order for checkout
        if not req.items:
            raise HTTPException(status_code=400, detail="split_items wajib untuk split by item")
            
        # 1. Fetch active orders
        orders = await db.orders.find({"session_id": session["id"], "store_id": user["store_id"]}).to_list(length=100)
        
        split_items_to_checkout = []
        for split_req_item in req.items:
            prod_id = split_req_item["product_id"]
            qty_to_split = split_req_item["quantity"]
            
            # Find and subtract from active orders
            found_qty = 0
            for o in orders:
                for it in o["items"]:
                    if it["product_id"] == prod_id and it["quantity"] > 0:
                        deduct = min(qty_to_split - found_qty, it["quantity"])
                        if deduct > 0:
                            # Save for the new split checkout order
                            split_items_to_checkout.append({
                                "product_id": prod_id,
                                "name": it["name"],
                                "price": it["price"],
                                "quantity": deduct,
                                "subtotal": it["price"] * deduct,
                                "note": it.get("note"),
                                "modifiers": it.get("modifiers")
                            })
                            
                            # Subtract from original order items list
                            it["quantity"] -= deduct
                            it["subtotal"] = it["quantity"] * it["price"]
                            found_qty += deduct
                            
                # Recalculate original order total
                subtotal = sum(i["subtotal"] for i in o["items"] if i["quantity"] > 0)
                # Keep active items only
                o["items"] = [i for i in o["items"] if i["quantity"] > 0]
                o["subtotal"] = subtotal
                
                # Update total
                base = max(0, subtotal - o["discount"])
                tax = base * o["tax_percent"] / 100
                o["tax_amount"] = tax
                o["total"] = base + tax
                o["updated_at"] = utcnow().isoformat()
                
                # Update in DB
                if len(o["items"]) == 0:
                    await db.orders.delete_one({"id": o["id"], "store_id": user["store_id"]})
                else:
                    await db.orders.replace_one({"id": o["id"], "store_id": user["store_id"]}, o)
                    
            if found_qty < qty_to_split:
                raise HTTPException(status_code=400, detail=f"Stok item {prod_id} di keranjang tidak mencukupi untuk displit")

        # 2. Create the new separate checkout order for the split items
        # Calculate totals
        subtotal_split = sum(it["subtotal"] for it in split_items_to_checkout)
        service_charge_split = round(subtotal_split * 0.05, 2)
        tax_pb1_split = round((subtotal_split + service_charge_split) * 0.10, 2)
        total_split = subtotal_split + service_charge_split + tax_pb1_split
        
        split_order_id = str(uuid.uuid4())
        split_order = {
            "id": split_order_id,
            "store_id": user["store_id"],
            "cashier_id": user["id"],
            "cashier_email": user["email"],
            "order_no": f"SPLIT-{uuid.uuid4().hex[:6].upper()}",
            "items": split_items_to_checkout,
            "subtotal": subtotal_split,
            "discount": 0,
            "tax_percent": 10.0,
            "tax_amount": tax_pb1_split,
            "total": total_split,
            "service_charge": service_charge_split,
            "tax_pb1": tax_pb1_split,
            "payment_method": "cash", # Default to cash first
            "payment_status": "pending",
            "created_at": utcnow().isoformat(),
            "updated_at": utcnow().isoformat()
        }
        await db.orders.insert_one(split_order)
        split_order.pop("_id", None)
        
        await notify_clients(user["store_id"])
        return {
            "type": "item",
            "split_order": split_order
        }
