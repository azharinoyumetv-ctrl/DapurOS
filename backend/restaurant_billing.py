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


async def active_session(db, user, table_id, session, expected=None):
    row = await db.order_sessions.find_one({"table_id": table_id, "store_id": user["store_id"], "status": "Active"}, session=session)
    if not row or expected and expected != row["id"]:
        raise HTTPException(409, "Sesi meja berubah. Muat ulang tagihan sebelum menerima pembayaran.")
    return row


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


async def settle_table(db, user, table_id, method, *, expected=None, cash=None, checked=False, amount=None):
    async def commit(session):
        active = await active_session(db, user, table_id, session, expected)
        rows = await db.orders.find({"session_id": active["id"], "store_id": user["store_id"], "payment_status": "pending"}, session=session).to_list(None)
        # Split bills are separate obligations; closing the table must not hide unpaid parts.
        if await db.orders.find_one({"source_session_id": active["id"], "store_id": user["store_id"], "payment_status": "pending"}, session=session):
            raise HTTPException(409, "Selesaikan bagian tagihan terpisah sebelum menutup meja.")
        total = sum((money(row["total"]) for row in rows), Decimal(0))
        if cash is not None and (not money(cash).is_finite() or money(cash) < total):
            raise HTTPException(400, "Pembayaran tunai kurang.")
        await settle_rows(db, user, rows, method, session, checked=checked, amount=amount)
        await db.order_sessions.update_one({"id": active["id"], "store_id": user["store_id"]}, {"$set": {"status": "Paid", "closed_at": utcnow().isoformat()}}, session=session)
        await db.tables.update_one({"id": table_id, "store_id": user["store_id"]}, {"$set": {"status": "Vacant", "updated_at": utcnow().isoformat()}}, session=session)
        return {"ok": True, "session_id": active["id"], "total": float(total)}
    return await run_transaction(db, commit)


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
                return {"type": "item", "split_order": row}
        rows = await db.orders.find({"session_id": active["id"], "store_id": user["store_id"], "payment_status": "pending"}, session=session).to_list(None)
        if request["type"] == "equal":
            ways = request.get("ways") or 2
            if isinstance(ways, bool) or not isinstance(ways, int) or not 2 <= ways <= 50:
                raise HTTPException(422, "Jumlah pembagian harus 2 sampai 50.")
            total = sum((money(row["total"]) for row in rows), Decimal(0))
            each = money(total / ways)
            return {"type": "equal", "ways": ways, "amount_per_person": float(each), "amounts": [float(each)] * (ways - 1) + [float(total - each * (ways - 1))]}
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
            for line in row["items"]:
                quantity = min(requested.get(line["product_id"], 0), line["quantity"])
                if not quantity:
                    continue
                original_quantity = line["quantity"]
                taken = {**line, "quantity": quantity, "subtotal": float(money(line["price"]) * quantity)}
                if "ingredient_deductions" in line:
                    taken["ingredient_deductions"] = [{**entry, "quantity": float(Decimal(str(entry["quantity"])) * quantity / original_quantity)} for entry in line["ingredient_deductions"]]
                    line["ingredient_deductions"] = [{**entry, "quantity": float(Decimal(str(entry["quantity"])) * (original_quantity - quantity) / original_quantity)} for entry in line["ingredient_deductions"]]
                split_lines.append(taken)
                line["quantity"] -= quantity
                line["subtotal"] = float(money(line["price"]) * line["quantity"])
                requested[line["product_id"]] -= quantity
                taken_subtotal += money(taken["subtotal"])
            if not taken_subtotal:
                continue
            portion = taken_subtotal / money(row["subtotal"])
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


async def settle_split(db, user, table_id, order_id, method):
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
        await settle_rows(db, user, [row], method, session)
        return {key: value for key, value in row.items() if key != "_id"}
    return await run_transaction(db, commit)
