"""POS / Orders routes."""
import os
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from database import get_db, utcnow, next_order_no
from models import OrderCreate, Order, OrderLineItem
from auth import get_current_user, require_admin
from plan_limits import require_plan
from xendit_client import create_qris, create_ewallet_charge
from doku_client import create_doku_checkout, DokuNotConfiguredError

router = APIRouter(prefix="/api/orders", tags=["orders"])


def _calc(order: OrderCreate) -> dict:
    subtotal = sum(i.subtotal for i in order.items)
    discount = order.discount or 0
    base = max(0, subtotal - discount)
    
    # F&B Billing
    if order.session_id:
        service_charge = round(base * 0.05, 2)
        tax_pb1 = round((base + service_charge) * 0.10, 2)
        total = base + service_charge + tax_pb1
        return {
            "subtotal": subtotal,
            "discount": discount,
            "service_charge": service_charge,
            "tax_pb1": tax_pb1,
            "tax_amount": tax_pb1, # Compatibility
            "total": total
        }
        
    tax = base * (order.tax_percent or 0) / 100
    total = base + tax
    return {
        "subtotal": subtotal,
        "discount": discount,
        "service_charge": 0.0,
        "tax_pb1": 0.0,
        "tax_amount": tax,
        "total": total
    }


@router.post("")
async def create_order(payload: OrderCreate, user: dict = Depends(get_current_user)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Order kosong")

    db = get_db()
    calc = _calc(payload)
    order_no = await next_order_no(user["store_id"])
    order_id = str(uuid.uuid4())

    change = None
    if payload.payment_method == "cash" and payload.cash_received is not None:
        change = round(payload.cash_received - calc["total"], 2)
        if change < 0:
            raise HTTPException(status_code=400, detail="Pembayaran tunai kurang")

    doc = {
        "id": order_id,
        "store_id": user["store_id"],
        "cashier_id": user["id"],
        "cashier_email": user["email"],
        "order_no": order_no,
        "items": [i.model_dump() for i in payload.items],
        "subtotal": calc["subtotal"],
        "discount": calc["discount"],
        "tax_percent": payload.tax_percent or 0,
        "tax_amount": calc["tax_amount"],
        "total": calc["total"],
        "service_charge": calc.get("service_charge", 0.0),
        "tax_pb1": calc.get("tax_pb1", 0.0),
        "session_id": payload.session_id,
        "dining_option": payload.dining_option or "Dine-In",
        "payment_method": payload.payment_method,
        # Order dine-in (punya session_id) selalu 'pending' — bill terbuka, dibayar saat settle meja.
        "payment_status": "pending" if payload.session_id else ("paid" if payload.payment_method == "cash" else "pending"),
        "ewallet_channel": payload.ewallet_channel,
        "customer_name": payload.customer_name,
        "customer_phone": payload.customer_phone,
        "customer_email": payload.customer_email,
        "cash_received": payload.cash_received,
        "change": change,
        "note": payload.note,
        "created_at": utcnow().isoformat(),
        "updated_at": utcnow().isoformat(),
    }

    # Payment gateway calls resolved BEFORE stock/KDS side effects below -- a misconfigured
    # or failed gateway must fail the request cleanly (no stock decrement, no kitchen ticket,
    # no order) instead of silently sending an unpayable order to the kitchen. An earlier
    # version swallowed this exception into xendit_raw only, which the frontend never
    # surfaces (POS.jsx only renders the QR/link block when xendit_qr_string /
    # xendit_checkout_url is present) -- customer and cashier saw nothing, silently, while
    # stock was already decremented and a KDS ticket already fired for a sale nobody could
    # actually pay for. Same class of fix as GerainaOS's routes_orders.py.
    #
    # Xendit/DOKU are both BYO per-store: credentials come from this store's own
    # integrations.{xendit,doku} config entered via Pengaturan > Integrasi, never a shared/
    # global key. (xendit_client.py used to read a single global XENDIT_SECRET_KEY env var
    # instead -- meaning a merchant's own saved key was silently never used for their own
    # store's transactions. Fixed to match DOKU/WhatsApp's per-tenant pattern.)
    integ = await db.integrations.find_one({"store_id": user["store_id"]}, {"_id": 0}) if payload.payment_method in ("qris", "ewallet", "doku") else None

    if payload.payment_method == "qris":
        xendit_cfg = (integ or {}).get("xendit") or {}
        try:
            res = await create_qris(cfg=xendit_cfg, external_id=order_no, amount=int(round(calc["total"])))
        except Exception as e:
            # 400, not 502: this is a "not configured / gateway declined" business outcome,
            # not an actual gateway failure -- Cloudflare intercepts 502/504/52x responses
            # from the origin and replaces them with its own generic error page.
            raise HTTPException(status_code=400, detail=f"QRIS belum dikonfigurasi atau gagal membuat kode QR ({e}). Atur Xendit di Pengaturan > Integrasi.")
        # v3 Payment Request API: id is payment_request_id, not id -- and QR string lives
        # in an actions[] entry (already flattened onto res["qr_string"] by create_qris).
        doc["xendit_id"] = res.get("payment_request_id") or res.get("id")
        doc["xendit_reference_id"] = order_no
        doc["xendit_qr_string"] = res.get("qr_string")
        doc["xendit_raw"] = res
    elif payload.payment_method == "ewallet":
        if not payload.ewallet_channel:
            raise HTTPException(status_code=400, detail="ewallet_channel wajib untuk e-wallet")
        xendit_cfg = (integ or {}).get("xendit") or {}
        try:
            res = await create_ewallet_charge(
                cfg=xendit_cfg,
                reference_id=order_no,
                amount=int(round(calc["total"])),
                channel_code=payload.ewallet_channel,
                customer_phone=payload.customer_phone,
                customer_email=payload.customer_email,
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"E-Wallet belum dikonfigurasi atau gagal memulai pembayaran ({e}). Atur Xendit di Pengaturan > Integrasi.")
        # Same v3 shape as QRIS above -- checkout_url already flattened by
        # create_ewallet_charge from the actions[] entry.
        doc["xendit_id"] = res.get("payment_request_id") or res.get("id")
        doc["xendit_reference_id"] = order_no
        doc["xendit_checkout_url"] = res.get("checkout_url")
        doc["xendit_raw"] = res
    elif payload.payment_method == "doku":
        doku_cfg = (integ or {}).get("doku") or {}
        return_base = os.environ.get("DOKU_RETURN_URL", "https://dagangos.com/dapuros/app/pos")
        try:
            res = await create_doku_checkout(
                cfg=doku_cfg,
                order_id=order_no,
                amount=int(round(calc["total"])),
                callback_url=f"{return_base}?order={order_no}",
                callback_url_result=f"{return_base}?order={order_no}",
                customer_name=payload.customer_name,
                customer_email=payload.customer_email,
                customer_phone=payload.customer_phone,
            )
        except DokuNotConfiguredError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"DOKU gagal membuat pembayaran ({e}). Atur DOKU di Pengaturan > Integrasi.")
        # From this point DOKU has already committed the transaction on its own side
        # (invoice created, may already have emailed the customer a payment link) -- nothing
        # below may raise and lose the order, or DapurOS ends up with a real pending DOKU
        # payment with zero local record (the webhook later no-ops silently since there's no
        # matching order_no to update). Parse defensively: an unexpected response shape must
        # degrade to missing fields, never an exception.
        doku_payment: dict = {}
        try:
            resp_block = res.get("response") if isinstance(res, dict) else None
            if isinstance(resp_block, dict) and isinstance(resp_block.get("payment"), dict):
                doku_payment = resp_block["payment"]
            elif isinstance(res, dict) and isinstance(res.get("payment"), dict):
                doku_payment = res["payment"]
        except Exception:
            doku_payment = {}
        doc["doku_id"] = ((res.get("order") or {}).get("invoice_number") if isinstance(res, dict) else None) or order_no
        doc["doku_token_id"] = doku_payment.get("token_id")
        doc["doku_checkout_url"] = doku_payment.get("url") or doku_payment.get("checkout_url")
        doc["doku_raw"] = res

    # Reduce stock atomically (supports BOM recipe-level deduction or standard product stock)
    # -- only after the payment gateway step above succeeded (or wasn't needed), so a failed
    # qris/ewallet/doku init never leaves stock decremented or a KDS ticket fired for an
    # order that was never actually payable.
    for it in payload.items:
        prod = await db.products.find_one({"id": it.product_id, "store_id": user["store_id"]})
        if prod and prod.get("recipe"):
            for rec_item in prod["recipe"]:
                ing_id = rec_item.get("ingredient_id")
                qty = rec_item.get("quantity") or rec_item.get("qty") or 0
                deduction = float(qty) * it.quantity
                await db.ingredients.update_one(
                    {"id": ing_id, "store_id": user["store_id"]},
                    {"$inc": {"stock": -deduction}}
                )
        else:
            await db.products.update_one(
                {"id": it.product_id, "store_id": user["store_id"]},
                {"$inc": {"stock": -it.quantity}},
            )

    # Route items to Kds Tickets (F&B)
    bar_items = []
    kitchen_items = []
    
    for it in payload.items:
        prod = await db.products.find_one({"id": it.product_id, "store_id": user["store_id"]})
        category = prod.get("category", "Makanan") if prod else "Makanan"
        station = "Bar" if str(category).lower() in ("minuman", "beverage", "drink", "drinks", "bar") else "Kitchen"
        
        kds_item = {
            "name": it.name,
            "qty": it.quantity,
            "notes": it.note,
            "status": "Pending"
        }
        if station == "Bar":
            bar_items.append(kds_item)
        else:
            kitchen_items.append(kds_item)
            
    table_label = "Takeaway"
    if payload.session_id:
        session = await db.order_sessions.find_one({"id": payload.session_id, "store_id": user["store_id"]})
        if session:
            # Mark table status as Dining
            await db.tables.update_one(
                {"id": session["table_id"], "store_id": user["store_id"]},
                {"$set": {"status": "Dining", "updated_at": utcnow().isoformat()}}
            )
            table = await db.tables.find_one({"id": session["table_id"], "store_id": user["store_id"]})
            if table:
                table_label = table["label"]
                
    for station, items in [("Bar", bar_items), ("Kitchen", kitchen_items)]:
        if items:
            kds_doc = {
                "id": str(uuid.uuid4()),
                "order_id": order_id,
                "table_label": table_label,
                "station": station,
                "time_elapsed": "Baru saja",
                "items": items,
                "store_id": user["store_id"],
                "created_at": utcnow().isoformat(),
                "updated_at": utcnow().isoformat()
            }
            await db.kds_tickets.insert_one(kds_doc)

    # Trigger WebSocket broadcast update
    try:
        from server import ws_manager
        await ws_manager.broadcast(user["store_id"], {"type": "ORDER_CREATE"})
    except Exception:
        pass

    try:
        await db.orders.insert_one(doc)
    except Exception:
        # Gateway (if any) already committed externally by this point, so losing the order
        # here would be worse than a slightly incomplete record. Retry once with the raw
        # gateway payload stripped, in case an oversized/odd-shaped doku_raw/xendit_raw blob
        # was what BSON choked on.
        doc.pop("doku_raw", None)
        doc.pop("xendit_raw", None)
        await db.orders.insert_one(doc)

    # Auto-kirim struk ke WhatsApp pelanggan (best-effort; toggle "Kirim Struk Otomatis").
    # Diinisiasi toko -> wajib template. Pakai template KUSTOM dagangos_order_receipt (Bahasa
    # Indonesia, tanpa tombol CTA, 4 parameter teks biasa) -- lihat TEMPLATE_RECEIPT_* di
    # whatsapp_client.py. Belum disetujui Meta pada saat kode ini ditulis; ajukan lewat Meta
    # Business Manager sebelum ini benar-benar bisa mengirim. Migrated off the old Fonnte/Wablas
    # gateway client onto Meta Cloud API (mirrors GerainaOS).
    try:
        if payload.customer_phone:
            from whatsapp_client import (
                get_wa_config, send_meta_message,
                TEMPLATE_RECEIPT_NAME_DEFAULT, TEMPLATE_RECEIPT_LANG_DEFAULT,
            )
            wa = await get_wa_config(db, user["store_id"])
            if wa.get("is_active"):
                settings = await db.settings.find_one({"store_id": user["store_id"]}, {"_id": 0})
                store_name = ((settings or {}).get("general") or {}).get("store_name") or user.get("store_name") or "Toko"
                total_str = f"{int(round(calc['total'])):,}".replace(",", ".")
                method_labels = {
                    "cash": "Tunai", "qris": "QRIS", "ewallet": "E-Wallet", "doku": "DOKU",
                    "edc": "Kartu (EDC)", "debit": "Kartu Debit", "credit": "Kartu Kredit", "card": "Kartu",
                }
                payment_method_label = method_labels.get(payload.payment_method, payload.payment_method or "-")
                template_name = wa.get("template_receipt") or TEMPLATE_RECEIPT_NAME_DEFAULT
                template_lang = wa.get("template_receipt_lang") or TEMPLATE_RECEIPT_LANG_DEFAULT
                params = [order_no, store_name, total_str, payment_method_label]
                doc["whatsapp"] = await send_meta_message(wa, payload.customer_phone, template_name, params, lang=template_lang)
    except Exception:
        pass

    doc.pop("_id", None)
    return doc


@router.get("")
async def list_orders(
    user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    limit: int = 200,
):
    db = get_db()
    flt = {"store_id": user["store_id"]}
    if status:
        flt["payment_status"] = status
    cursor = db.orders.find(flt, {"_id": 0}).sort("created_at", -1).limit(limit)
    return await cursor.to_list(length=limit)


@router.get("/stats")
async def stats(user: dict = Depends(get_current_user)):
    db = get_db()
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    week_start = (now - timedelta(days=7)).isoformat()
    month_start = (now - timedelta(days=30)).isoformat()

    async def sum_in(after: str, paid_only: bool = True) -> dict:
        match = {"store_id": user["store_id"], "created_at": {"$gte": after}}
        if paid_only:
            match["payment_status"] = "paid"
        cur = db.orders.aggregate([
            {"$match": match},
            {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}},
        ])
        rows = await cur.to_list(length=1)
        return rows[0] if rows else {"total": 0, "count": 0}

    today = await sum_in(today_start)
    week = await sum_in(week_start)
    month = await sum_in(month_start)
    product_count = await db.products.count_documents({"store_id": user["store_id"]})
    return {
        "today_sales": today.get("total", 0),
        "today_orders": today.get("count", 0),
        "week_sales": week.get("total", 0),
        "week_orders": week.get("count", 0),
        "month_sales": month.get("total", 0),
        "month_orders": month.get("count", 0),
        "product_count": product_count,
    }


@router.get("/product-sales")
async def product_sales(user: dict = Depends(require_plan("pro")), days: int = 30, limit: int = 10):
    """Laporan produk terjual REAL: agregasi qty + revenue per produk dari order LUNAS.

    Pro-tier feature (part of the Laporan module) -- see AppLayout.jsx minPlan."""
    db = get_db()
    from datetime import datetime, timezone, timedelta
    after = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    cur = db.orders.aggregate([
        {"$match": {"store_id": user["store_id"], "payment_status": "paid", "created_at": {"$gte": after}}},
        {"$unwind": "$items"},
        {"$group": {
            "_id": {"pid": "$items.product_id", "name": "$items.name"},
            "sold": {"$sum": "$items.quantity"},
            "revenue": {"$sum": "$items.subtotal"},
        }},
        {"$sort": {"sold": -1}},
        {"$limit": limit},
    ])
    rows = await cur.to_list(length=limit)
    return [
        {
            "product_id": r["_id"].get("pid"),
            "name": r["_id"].get("name") or "-",
            "sold": r.get("sold", 0),
            "revenue": r.get("revenue", 0),
        }
        for r in rows
    ]


@router.get("/sales-trend")
async def sales_trend(user: dict = Depends(require_plan("pro")), days: int = 7):
    """Real daily sales aggregation (paid orders only) for the last N days.

    Replaces the previous frontend pattern of inventing a daily breakdown by
    multiplying a weekly total by fixed percentages. Pro-tier feature (part of the
    Laporan module) -- see AppLayout.jsx minPlan.
    """
    db = get_db()
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    cur = db.orders.aggregate([
        {"$match": {"store_id": user["store_id"], "payment_status": "paid", "created_at": {"$gte": start.isoformat()}}},
        {"$addFields": {"_created_dt": {"$dateFromString": {"dateString": "$created_at"}}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$_created_dt"}},
            "sales": {"$sum": "$total"},
            "orders": {"$sum": 1},
        }},
    ])
    rows = await cur.to_list(length=days)
    by_date = {r["_id"]: r for r in rows}
    day_labels_id = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
    result = []
    for i in range(days - 1, -1, -1):
        d = now - timedelta(days=i)
        key = d.strftime("%Y-%m-%d")
        row = by_date.get(key)
        result.append({
            "date": key,
            "day": day_labels_id[d.weekday()],
            "sales": round(row["sales"], 2) if row else 0.0,
            "orders": row["orders"] if row else 0,
        })
    return result


@router.get("/payment-methods")
async def payment_methods(user: dict = Depends(require_plan("pro")), days: int = 7):
    """Real payment-method breakdown (paid orders only) for the last N days. Pro-tier feature
    (part of the Laporan module) -- see AppLayout.jsx minPlan.

    Replaces the previous frontend pattern of a flat, never-updated payment-method split.
    """
    db = get_db()
    from datetime import datetime, timezone, timedelta
    after = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    cur = db.orders.aggregate([
        {"$match": {"store_id": user["store_id"], "payment_status": "paid", "created_at": {"$gte": after}}},
        {"$group": {"_id": "$payment_method", "total": {"$sum": "$total"}, "count": {"$sum": 1}}},
    ])
    rows = await cur.to_list(length=20)
    return [
        {"method": (r["_id"] or "unknown"), "total": round(r.get("total", 0), 2), "count": r.get("count", 0)}
        for r in rows
    ]


@router.get("/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await db.orders.find_one({"id": order_id, "store_id": user["store_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan")
    return doc


@router.post("/{order_id}/mark-paid")
async def mark_paid(order_id: str, user: dict = Depends(require_admin)):
    """Owner-only manual settle: confirm a pending non-cash order was actually received
    (e.g. paid via the merchant's own external EDC/QRIS). Not a payment simulator."""
    db = get_db()
    res = await db.orders.find_one_and_update(
        {"id": order_id, "store_id": user["store_id"]},
        {"$set": {"payment_status": "paid", "updated_at": utcnow().isoformat()}},
        return_document=True,
        projection={"_id": 0},
    )
    if not res:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan")
    return res


@router.post("/{order_id}/void")
async def void_order(order_id: str, user: dict = Depends(require_admin)):
    """Batalkan order (owner-only): set payment_status 'voided' dan KEMBALIKAN stok/bahan
    yang sudah dipotong saat order dibuat. Idempotent."""
    db = get_db()
    order = await db.orders.find_one({"id": order_id, "store_id": user["store_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan")
    if order.get("payment_status") == "voided":
        return {"ok": True, "already_voided": True}

    for it in order.get("items", []):
        pid = it.get("product_id")
        qty = it.get("quantity", 0)
        prod = await db.products.find_one({"id": pid, "store_id": user["store_id"]})
        if prod and prod.get("recipe"):
            for rec in prod["recipe"]:
                ing_id = rec.get("ingredient_id")
                rec_qty = rec.get("quantity") or rec.get("qty") or 0
                await db.ingredients.update_one(
                    {"id": ing_id, "store_id": user["store_id"]},
                    {"$inc": {"stock": float(rec_qty) * qty}},
                )
        elif prod:
            await db.products.update_one(
                {"id": pid, "store_id": user["store_id"]},
                {"$inc": {"stock": qty}},
            )

    await db.orders.update_one(
        {"id": order_id, "store_id": user["store_id"]},
        {"$set": {"payment_status": "voided", "updated_at": utcnow().isoformat()}},
    )
    return {"ok": True}
