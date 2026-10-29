"""Restaurant inventory and kitchen effects within the caller's sale transaction."""
import uuid
from decimal import Decimal
from fastapi import HTTPException
from database import utcnow


async def deduct(db, user, line, session, *, offline=False):
    scope = {"id": line["product_id"], "store_id": user["store_id"]}
    product = await db.products.find_one(scope, session=session)
    if not product:
        raise HTTPException(409, "Menu tidak tersedia. Transaksi perangkat tetap disimpan untuk diperiksa.")
    recipe = product.get("recipe") or []
    deductions = []
    for item in recipe:
        quantity = Decimal(str(item.get("quantity", item.get("qty", 0)))) * line["quantity"]
        if not quantity.is_finite() or quantity <= 0:
            raise HTTPException(409, "Resep menu tidak valid. Periksa bahan baku.")
        ingredient_scope = {"id": item.get("ingredient_id"), "store_id": user["store_id"]}
        if not await db.ingredients.find_one(ingredient_scope, session=session):
            raise HTTPException(409, "Bahan resep tidak tersedia. Periksa menu sebelum melanjutkan.")
        check = ingredient_scope if offline else {**ingredient_scope, "stock": {"$gte": float(quantity)}}
        changed = await db.ingredients.update_one(check, {"$inc": {"stock": -float(quantity)}}, session=session)
        if not changed.modified_count:
            raise HTTPException(409, "Stok bahan baku tidak cukup.")
        deductions.append({"ingredient_id": item["ingredient_id"], "quantity": float(quantity)})
    if not recipe:
        check = scope if offline else {**scope, "stock": {"$gte": line["quantity"]}}
        result = await db.products.update_one(check, {"$inc": {"stock": -line["quantity"]}}, session=session)
        if not result.modified_count:
            raise HTTPException(409, "Stok menu tidak cukup.")
    return {**line, "ingredient_deductions": deductions, "recipe_applied_at_sync": bool(recipe and offline)}, product


async def restore(db, store_id, line, session):
    # A saved snapshot survives later recipe edits. Legacy orders use their original rule.
    if "ingredient_deductions" in line:
        deductions = line["ingredient_deductions"]
    else:
        product = await db.products.find_one({"id": line["product_id"], "store_id": store_id}, session=session)
        deductions = [{"ingredient_id": r["ingredient_id"], "quantity": float(r.get("quantity", r.get("qty", 0))) * line["quantity"]}
                      for r in (product or {}).get("recipe", [])]
    if deductions:
        for item in deductions:
            await db.ingredients.update_one({"id": item["ingredient_id"], "store_id": store_id},
                                            {"$inc": {"stock": item["quantity"]}}, session=session)
    else:
        await db.products.update_one({"id": line["product_id"], "store_id": store_id},
                                     {"$inc": {"stock": line["quantity"]}}, session=session)


async def kitchen(db, user, order, session, session_id=None):
    table_label = "Takeaway"
    if session_id:
        active = await db.order_sessions.find_one({"id": session_id, "store_id": user["store_id"], "status": "Active"}, session=session)
        if not active:
            raise HTTPException(409, "Sesi meja sudah berubah. Buka kembali meja sebelum mengirim pesanan.")
        table = await db.tables.find_one({"id": active["table_id"], "store_id": user["store_id"]}, session=session)
        if not table:
            raise HTTPException(409, "Meja tidak tersedia.")
        table_label = table["label"]
        await db.tables.update_one({"id": table["id"], "store_id": user["store_id"]}, {"$set": {"status": "Dining"}}, session=session)
    groups = {"Bar": [], "Kitchen": []}
    for line in order["items"]:
        product = await db.products.find_one({"id": line["product_id"], "store_id": user["store_id"]}, session=session)
        category = str((product or {}).get("category", "")).lower()
        station = "Bar" if any(word in category for word in ("minuman", "beverage", "drink", "bar")) else "Kitchen"
        groups[station].append({"name": line["name"], "qty": line["quantity"], "notes": line.get("note"), "status": "Pending"})
    for station, items in groups.items():
        if items:
            await db.kds_tickets.insert_one({"_id": f"{order['id']}:{station}", "id": str(uuid.uuid4()),
                "order_id": order["id"], "table_label": table_label, "station": station, "items": items,
                "store_id": user["store_id"], "created_at": utcnow().isoformat(), "updated_at": utcnow().isoformat()}, session=session)
