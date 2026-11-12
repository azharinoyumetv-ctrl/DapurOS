"""Atomic table/split billing, retaining recipe snapshots and existing restaurant fees."""
import hashlib
import json
from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4
from fastapi import HTTPException
from database import utcnow
from bank_qris import bank_qris_snapshot
from payment_options import require_payment_method
from sale_effects import apply_loyalty
from transactions import run_transaction


def money(value):
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


async def lock_bill(db, active, session, *, allow_payment=False):
    if active.get("gateway_payment_id") and not allow_payment:
        raise HTTPException(409, "Pembayaran gateway sedang berlangsung. Periksa status sebelum mengubah tagihan.")
    # All bill mutations write the same session so a concurrent checkout cannot
    # miss a new order or accept a bill while it is being split or voided.
    await db.order_sessions.update_one({"_id": active["_id"]}, {"$inc": {"bill_revision": 1}}, session=session)


async def active_session(db, user, table_id, session, expected=None, *, allow_payment=False):
    row = await db.order_sessions.find_one({"table_id": table_id, "store_id": user["store_id"], "status": "Active"}, session=session)
    if not row or expected and expected != row["id"]:
        raise HTTPException(409, "Sesi meja berubah. Muat ulang tagihan sebelum menerima pembayaran.")
    await lock_bill(db, row, session, allow_payment=allow_payment)
    return row


async def bill_rows(db, store_id, session_id, session):
    scope = {"store_id": store_id, "payment_status": "pending"}
    rows = await db.orders.find({**scope, "session_id": session_id}, session=session).to_list(None)
    if await db.orders.find_one({**scope, "source_session_id": session_id}, session=session):
        raise HTTPException(409, "Selesaikan bagian tagihan terpisah sebelum menutup meja.")
    return rows, sum((money(row["total"]) for row in rows), Decimal(0))


async def get_table_receipt(db, store_id, session_id, table_id=None):
    scope = {"id": session_id, "store_id": store_id, "status": "Paid"}
    if table_id is not None:
        scope["table_id"] = table_id
    row = await db.order_sessions.find_one(scope, {"_id": 0, "receipt": 1})
    if not row or not row.get("receipt"):
        raise HTTPException(404, "Struk meja belum tersedia.")
    return row["receipt"]


async def close_paid_table(db, active, session, rows, method, total, *, cash=None, provider=None, channel=None):
    now = utcnow().isoformat()
    updates = {"status": "Paid", "closed_at": now}
    receipt = None
    if any(row.get("items") for row in rows):
        table = await db.tables.find_one({"id": active["table_id"], "store_id": active["store_id"]},
                                         {"label": 1}, session=session) or {}
        receipt = {
            "id": "table-" + active["id"], "order_no": "MEJA-" + active["id"].replace("-", "")[:16].upper(),
            "table_label": table.get("label"), "dining_option": "Dine-In",
            "items": [{key: item[key] for key in ("product_id", "name", "quantity", "price", "subtotal")}
                      for row in sorted(rows, key=lambda row: row.get("created_at", "")) for item in row.get("items", [])],
            "payment_status": "paid", "payment_method": method, "payment_provider": provider, "ewallet_channel": channel,
            "total": float(total), "tax_percent": 10, "created_at": now,
            **{field: float(sum((money(row.get(field, 0)) for row in rows), Decimal(0)))
               for field in ("subtotal", "discount", "service_charge", "tax_amount")},
        }
        if method == "cash":
            receipt.update(cash_received=float(money(cash)), change=float(money(cash) - total))
        if method == "qris_bank":
            receipt["payment_confirmation"] = {"type": "manual_bank", "confirmed_at": now}
        updates["receipt"] = receipt
        await db.orders.update_many({"store_id": active["store_id"], "id": {"$in": [row["id"] for row in rows]}},
                                    {"$set": {"table_receipt_id": receipt["id"]}}, session=session)
    await db.order_sessions.update_one({"_id": active["_id"]}, {"$set": updates}, session=session)
    await db.tables.update_one({"id": active["table_id"], "store_id": active["store_id"]}, {"$set": {"status": "Vacant", "updated_at": now}}, session=session)
    return receipt


async def settle_rows(db, user, rows, method, session, *, checked=False, amount=None):
    if method not in ("cash", "qris_bank"):
        raise HTTPException(400, "Penyelesaian meja mendukung tunai atau QRIS bank yang sudah dikonfigurasi.")
    await require_payment_method(db, user, method)
    total = sum((money(row["total"]) for row in rows), Decimal(0))
    now = utcnow().isoformat()
    bank = None
    if method == "qris_bank":
        if checked is not True or amount is None or money(amount) != total:
            raise HTTPException(400, "Periksa penerimaan nominal tagihan yang sama di aplikasi bank merchant.")
        saved = await db.bank_qris_configs.find_one({"store_id": user["store_id"]}, session=session)
        try:
            bank = bank_qris_snapshot(saved, total)
        except ValueError as error:
            raise HTTPException(400, str(error))
    for row in rows:
        updates = {"payment_status": "paid", "payment_method": method, "updated_at": now,
                   "payment_confirmation": {"type": "manual_bank" if bank else "cash", "bank_verified": False,
                       "confirmed_by": user["id"], "confirmed_at": now, "received_amount": float(money(row["total"]))}}
        if bank:
            updates["bank_qris"] = bank
        await db.orders.update_one({"id": row["id"], "store_id": user["store_id"], "payment_status": "pending"}, {"$set": updates}, session=session)
        row.update(updates)
        await apply_loyalty(db, row, session)
    return total


def require_cash_received(total, cash):
    if cash is None:
        raise HTTPException(400, "Masukkan jumlah uang tunai yang diterima.")
    value = Decimal(str(cash))
    if not value.is_finite() or value < 0 or value > Decimal("1000000000000000") or value < total or value != money(value):
        raise HTTPException(400, "Jumlah tunai tidak valid atau kurang dari total tagihan.")


async def settle_table(db, user, table_id, method, *, expected=None, cash=None, checked=False, amount=None, expected_total=None):
    async def commit(session):
        active = await active_session(db, user, table_id, session, expected)
        rows, total = await bill_rows(db, user["store_id"], active["id"], session)
        if expected_total is not None and (not money(expected_total).is_finite() or money(expected_total)!=total):
            raise HTTPException(409,'Tagihan bertambah atau berubah. Muat ulang sebelum menerima pembayaran.')
        if method == "cash":
            require_cash_received(total, cash)
        await settle_rows(db, user, rows, method, session, checked=checked, amount=amount)
        receipt = await close_paid_table(db, active, session, rows, method, total, cash=cash)
        return {"ok": True, "session_id": active["id"], "total": float(total), "receipt": receipt}
    return await run_transaction(db, commit)


async def close_empty(db,user,table_id,expected):
    async def close(session):
        existing=await db.order_sessions.find_one({'id':expected,'store_id':user['store_id'],'table_id':table_id},session=session)
        if existing and existing.get('status') in ('Closed','Paid') and not await db.order_sessions.find_one({'store_id':user['store_id'],'table_id':table_id,'status':'Active'},session=session):return {'ok':True}
        active=await active_session(db,user,table_id,session,expected)
        if await db.orders.find_one({'store_id':user['store_id'],'payment_status':'pending','$or':[{'session_id':active['id']},{'source_session_id':active['id']}]},session=session):
            raise HTTPException(409,'Meja masih memiliki tagihan. Selesaikan pembayaran sebelum mengosongkan meja.')
        await db.order_sessions.update_one({'id':active['id'],'store_id':user['store_id']},{'$set':{'status':'Closed','closed_at':utcnow().isoformat()}},session=session)
        await db.tables.update_one({'id':table_id,'store_id':user['store_id']},{'$set':{'status':'Vacant','updated_at':utcnow().isoformat()}},session=session)
        return {'ok':True}
    return await run_transaction(db,close)


async def split_table(db, user, table_id, request, key=None):
    if key is not None and (not 1 <= len(key) <= 200 or any(ord(c) < 32 for c in key)):
        raise HTTPException(422, "Referensi pembagian tagihan tidak valid.")
    async def commit(session):
        active = await active_session(db, user, table_id, session)
        digest = hashlib.sha256(json.dumps(request, sort_keys=True).encode()).hexdigest()
        attempt = f"{user['store_id']}:split:{key}" if key else None
        if attempt:
            previous = await db.checkout_attempts.find_one({"_id": attempt}, session=session)
            if previous:
                if previous["request_hash"] != digest or previous["cashier_id"] != user["id"]:
                    raise HTTPException(409, "Referensi pembagian tagihan sudah digunakan.")
                row = await db.orders.find_one({"id": previous["order_id"], "store_id": user["store_id"]}, {"_id": 0}, session=session)
                if not row or row.get("source_session_id") != active["id"]:
                    raise HTTPException(409, "Referensi pembagian tagihan berasal dari sesi meja lain.")
                return {"type": "item", "split_order": row}
        rows = await db.orders.find({"session_id": active["id"], "store_id": user["store_id"], "payment_status": "pending"}, session=session).to_list(None)
        if request["type"] == "equal":
            ways = request.get("ways")
            if ways is None:
                ways = 2
            if isinstance(ways, bool) or not isinstance(ways, int) or not 2 <= ways <= 50:
                raise HTTPException(422, "Jumlah pembagian harus 2 sampai 50.")
            total = sum((money(row["total"]) for row in rows), Decimal(0))
            cents, remainder = divmod(int(total * 100), ways)
            amounts = [(cents + (index < remainder)) / 100 for index in range(ways)]
            return {"type": "equal", "ways": ways, "amount_per_person": float(money(total / ways)), "amounts": amounts}
        requested = {}
        for item in request.get("items") or []:
            quantity = item.get("quantity")
            if not isinstance(item.get("product_id"), str) or isinstance(quantity, bool) or not isinstance(quantity, int) or quantity <= 0 or item["product_id"] in requested:
                raise HTTPException(422, "Item pembagian tidak valid atau duplikat.")
            requested[item["product_id"]] = quantity
        if not requested:
            raise HTTPException(422, "Pilih item untuk dipisahkan.")
        for pid, quantity in requested.items():
            available = sum(line["quantity"] for row in rows for line in row["items"] if line["product_id"] == pid)
            if quantity > available:
                raise HTTPException(409, "Jumlah item tagihan berubah. Muat ulang tagihan.")
        split_lines, totals = [], {field: Decimal(0) for field in ("subtotal", "discount", "service_charge", "tax_amount", "tax_pb1", "total")}
        for row in rows:
            taken_subtotal = Decimal(0)
            taken_quantity = 0
            for line in row["items"]:
                quantity = min(requested.get(line["product_id"], 0), line["quantity"])
                if not quantity:
                    continue
                original_quantity = line["quantity"]
                taken = {**line, "quantity": quantity, "subtotal": float(money(line["price"]) * quantity)}
                taken['source_order_id']=row['id']
                if "ingredient_deductions" in line:
                    taken["ingredient_deductions"] = [{**entry, "quantity": float(Decimal(str(entry["quantity"])) * quantity / original_quantity)} for entry in line["ingredient_deductions"]]
                    line["ingredient_deductions"] = [{**entry, "quantity": float(Decimal(str(entry["quantity"])) * (original_quantity - quantity) / original_quantity)} for entry in line["ingredient_deductions"]]
                split_lines.append(taken)
                line["quantity"] -= quantity
                line["subtotal"] = float(money(line["price"]) * line["quantity"])
                requested[line["product_id"]] -= quantity
                taken_quantity += quantity
                taken_subtotal += money(taken["subtotal"])
            if not taken_quantity:
                continue
            original_subtotal = money(row["subtotal"])
            portion = taken_subtotal / original_subtotal if original_subtotal else Decimal(0)
            for field in totals:
                allocation = taken_subtotal if field == "subtotal" else money(money(row.get(field, 0)) * portion)
                totals[field] += allocation
                row[field] = float(money(row.get(field, 0)) - allocation)
            row["items"] = [line for line in row["items"] if line["quantity"] > 0]
            await db.orders.update_one({"id": row["id"], "store_id": user["store_id"]}, {"$set": {key: value for key, value in row.items() if key != "_id"}}, session=session)
        identifier, now = str(uuid4()), utcnow().isoformat()
        split = {"id": identifier, "store_id": user["store_id"], "cashier_id": user["id"], "cashier_email": user["email"],
                 "order_no": "SPLIT-" + identifier[:8].upper(), "items": split_lines, **{k: float(v) for k, v in totals.items()},
                 "tax_percent": 10, "payment_method": "cash", "payment_status": "pending", "source_session_id": active["id"],
                 "inventory_applied": True, "dining_option": "Dine-In", "created_at": now, "updated_at": now}
        await db.orders.insert_one(dict(split), session=session)
        if attempt:
            await db.checkout_attempts.insert_one({"_id": attempt, "store_id": user["store_id"], "cashier_id": user["id"], "request_hash": digest, "order_id": identifier}, session=session)
        return {"type": "item", "split_order": split}
    return await run_transaction(db, commit)


async def settle_split(db, user, table_id, order_id, method, *, cash=None, expected_total=None):
    async def commit(session):
        active = await active_session(db, user, table_id, session)
        row = await db.orders.find_one({"id": order_id, "store_id": user["store_id"], "source_session_id": active["id"]}, session=session)
        if not row:
            raise HTTPException(404, "Bagian tagihan tidak ditemukan.")
        if row["payment_status"] != "pending":
            if row["payment_status"] == "paid":
                return {key: value for key, value in row.items() if key != "_id"}
            raise HTTPException(409, "Status bagian tagihan sudah berubah.")
        if method != "cash":
            raise HTTPException(400, "Bagian tagihan ini diselesaikan tunai. Pembayaran elektronik dilakukan dari tagihan meja utuh.")
        total = money(row["total"])
        if expected_total is not None and money(expected_total) != total:
            raise HTTPException(409, "Bagian tagihan berubah. Muat ulang sebelum menerima pembayaran.")
        require_cash_received(total, cash)
        await settle_rows(db, user, [row], method, session)
        tender = {"cash_received": float(money(cash)), "change": float(money(cash) - total)}
        await db.orders.update_one({"_id": row["_id"]}, {"$set": tender}, session=session)
        return {**{key: value for key, value in row.items() if key != "_id"}, **tender}
    return await run_transaction(db, commit)
