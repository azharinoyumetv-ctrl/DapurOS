from product_scope import product_scope, inventory_scope
"""Restaurant inventory and kitchen effects within the caller's sale transaction."""
import re
import uuid
from fastapi import HTTPException
from database import utcnow
from recipe_stock import recipe_requirements, stock_decimal, stock_remaining


async def deduct(db, user, line, session, *, offline=False):
    scope = product_scope(user["store_id"],id=line["product_id"])
    product = await db.products.find_one(scope, session=session)
    if not product:
        raise HTTPException(409, "Menu tidak tersedia. Transaksi perangkat tetap disimpan untuk diperiksa.")
    recipe = product.get("recipe") or []
    deductions = []
    try:
        requirements = recipe_requirements(recipe)
    except (TypeError, ValueError):
        raise HTTPException(409, "Resep menu tidak valid. Periksa bahan baku.") from None
    for identifier, per_portion in requirements.items():
        quantity = per_portion * line["quantity"]
        ingredient_scope = {"id": identifier, "store_id": user["store_id"]}
        ingredient=await db.ingredients.find_one(ingredient_scope, session=session)
        if not ingredient:
            raise HTTPException(409, "Bahan resep tidak tersedia. Periksa menu sebelum melanjutkan.")
        balance = stock_decimal(ingredient.get("stock"))
        remaining = stock_remaining(balance, quantity)
        if not offline and remaining < 0:
            raise HTTPException(409, "Stok bahan baku tidak cukup.")
        updated_stock = float(remaining)
        if updated_stock == float(balance):
            raise HTTPException(409, "Takaran resep terlalu kecil untuk dicatat. Periksa satuan bahan baku.")
        await db.ingredients.update_one(ingredient_scope, {"$set": {"stock": updated_stock}}, session=session)
        deductions.append({"ingredient_id": identifier, "quantity": float(quantity), "name": ingredient.get("name"), "unit": ingredient.get("unit")})
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
        product = await db.products.find_one(product_scope(store_id,id=line["product_id"]), session=session)
        deductions = [{"ingredient_id": r["ingredient_id"], "quantity": float(r.get("quantity", r.get("qty", 0))) * line["quantity"]}
                      for r in (product or {}).get("recipe", [])]
    if deductions:
        for item in deductions:
            scope = {"id": item["ingredient_id"], "store_id": store_id}
            ingredient = await db.ingredients.find_one(scope, session=session)
            if ingredient:
                restored = stock_decimal(ingredient.get("stock")) + stock_decimal(item["quantity"])
                await db.ingredients.update_one(scope, {"$set": {"stock": float(restored)}}, session=session)
    else:
        await db.products.update_one(product_scope(store_id,id=line["product_id"]),
                                     {"$inc": {"stock": line["quantity"]}}, session=session)


def ticket_station(product):
    configured = product.get("ticket_station")
    if configured in ("Bar", "Kitchen"):
        return configured
    category = str(product.get("category") or "").casefold()
    words = set(re.findall(r"[^\W_]+", category))
    if words & {"bar", "kopi", "coffee"} or any(word in category for word in ("minuman", "beverage", "drink")):
        return "Bar"
    return "Kitchen"


async def kitchen(db, user, order, session, session_id=None):
    from restaurant_billing import lock_bill
    table_label = "Takeaway"
    if session_id:
        active = await db.order_sessions.find_one({"id": session_id, "store_id": user["store_id"], "status": "Active"}, session=session)
        if not active:
            raise HTTPException(409, "Sesi meja sudah berubah. Buka kembali meja sebelum mengirim pesanan.")
        await lock_bill(db, active, session)
        table = await db.tables.find_one({"id": active["table_id"], "store_id": user["store_id"]}, session=session)
        if not table:
            raise HTTPException(409, "Meja tidak tersedia.")
        table_label = table["label"]
        await db.tables.update_one({"id": table["id"], "store_id": user["store_id"]}, {"$set": {"status": "Dining"}}, session=session)
    groups = {"Bar": [], "Kitchen": []}
    ids = list({line["product_id"] for line in order["items"]})
    products = await db.products.find(
        product_scope(user["store_id"], id={"$in": ids}),
        {"_id": 0, "id": 1, "ticket_station": 1, "category": 1},
        session=session,
    ).to_list(None)
    stations = {product["id"]: ticket_station(product) for product in products}
    for line in order["items"]:
        station = stations.get(line["product_id"], "Kitchen")
        groups[station].append({"product_id":line['product_id'],"name": line["name"], "qty": line["quantity"], "notes": line.get("note"), "status": "Pending"})
    for station, items in groups.items():
        if items:
            await db.kds_tickets.insert_one({"_id": f"{order['id']}:{station}", "id": str(uuid.uuid4()),
                "order_id": order["id"], "table_label": table_label, "station": station, "items": items,
                "store_id": user["store_id"], "created_at": utcnow().isoformat(), "updated_at": utcnow().isoformat()}, session=session)


async def cancel_kitchen(db,store_id,order,session):
    plans={}
    for line in order.get('items',[]):
        source=line.get('source_order_id') or order['id']
        plans.setdefault(source,[]).append({'product_id':line['product_id'],'name':line['name'],'note':line.get('note') or '', 'remaining':line['quantity']})
    for source,lines in plans.items():
        tickets=await db.kds_tickets.find({'store_id':store_id,'order_id':source},session=session).to_list(None)
        for ticket in tickets:
            items=[]
            for item in ticket.get('items',[]):
                item=dict(item)
                for line in lines:
                    matches=(item.get('product_id')==line['product_id'] if item.get('product_id') else item['name']==line['name']) and (item.get('notes') or '')==line['note']
                    if matches:
                        removed=min(item['qty'],line['remaining']);item['qty']-=removed;line['remaining']-=removed
                if item['qty']>0:items.append(item)
            scope={'id':ticket['id'],'store_id':store_id}
            if items:await db.kds_tickets.update_one(scope,{'$set':{'items':items}},session=session)
            else:await db.kds_tickets.delete_one(scope,session=session)


async def notify_orders(store_id):
    try:
        from server import ws_manager
        await ws_manager.broadcast(store_id,{'type':'ORDER_CREATE'})
    except Exception:
        pass
