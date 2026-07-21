"""Xendit webhook handler.

Endpoint: POST /api/webhooks/xendit
Auth: header x-callback-token must match XENDIT_WEBHOOK_TOKEN.
Maps reference_id back to order, updates payment_status.
"""
import logging
import os
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks

from database import get_db
from doku_client import verify_doku_signature, map_doku_status

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

logger = logging.getLogger("dapuros.webhooks")

WEBHOOK_TOKEN = os.environ.get("XENDIT_WEBHOOK_TOKEN", "")


def _map_status(payload: dict) -> str:
    """Map Xendit status across QR & e-wallet to internal status."""
    s = (payload.get("status") or payload.get("transaction_status") or "").upper()
    if s in ("SUCCEEDED", "COMPLETED", "SUCCESS", "PAID", "ACTIVE"):
        # 'ACTIVE' only used for QR creation event; we ignore. We treat actual payment SUCCEEDED/COMPLETED.
        if s == "ACTIVE":
            return "pending"
        return "paid"
    if s in ("FAILED", "EXPIRED"):
        return "failed"
    if s in ("VOIDED",):
        return "voided"
    if s in ("REFUNDED",):
        return "refunded"
    return "pending"


async def _process(payload: dict):
    db = get_db()
    # Possible fields: reference_id (e-wallet/qr v2), external_id (qr v1), data.reference_id
    ref = (
        payload.get("reference_id")
        or payload.get("external_id")
        or (payload.get("data") or {}).get("reference_id")
        or (payload.get("data") or {}).get("external_id")
    )
    if not ref:
        return

    # Look up the order first (instead of blind update_one) so we know which store it
    # belongs to and what it's actually worth. order_no/xendit_reference_id is meant to be
    # unique, but a payload alone carries no store scoping — resolving the order here lets
    # us filter the update by store_id and verify the amount before ever flipping to "paid",
    # so a webhook meant for one store's payment can't silently mark a different store's
    # order as paid.
    order = await db.orders.find_one(
        {"xendit_reference_id": ref}, {"_id": 0, "id": 1, "store_id": 1, "total": 1, "order_no": 1}
    )
    if not order:
        logger.warning("Xendit webhook: no order found for reference_id=%s", ref)
        return

    new_status = _map_status(payload if "status" in payload else (payload.get("data") or payload))

    if new_status == "paid":
        webhook_amount = (
            payload.get("amount")
            or payload.get("capture_amount")
            or payload.get("charge_amount")
            or (payload.get("data") or {}).get("amount")
        )
        if webhook_amount is not None:
            try:
                if round(float(webhook_amount)) != round(float(order.get("total", 0))):
                    logger.warning(
                        "Xendit webhook amount mismatch for order_no=%s store_id=%s: "
                        "webhook_amount=%r order_total=%r — ignoring payment_status update.",
                        order.get("order_no"), order.get("store_id"), webhook_amount, order.get("total"),
                    )
                    return
            except (TypeError, ValueError):
                logger.warning(
                    "Xendit webhook: could not parse amount %r for order_no=%s — ignoring payment_status update.",
                    webhook_amount, order.get("order_no"),
                )
                return

    await db.orders.update_one(
        {"xendit_reference_id": ref, "store_id": order["store_id"]},
        {
            "$set": {
                "payment_status": new_status,
                "xendit_webhook_payload": payload,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )


@router.post("/xendit")
async def xendit_webhook(req: Request, background: BackgroundTasks):
    token = req.headers.get("x-callback-token") or req.headers.get("X-Callback-Token")
    if not WEBHOOK_TOKEN or token != WEBHOOK_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid callback token")
    payload = await req.json()
    background.add_task(_process, payload)
    return {"received": True}


@router.post("/xendit/simulate")
async def simulate_webhook(payload: dict, req: Request):
    """Dev-only simulator (no token required) for local end-to-end tests."""
    if (os.environ.get("ALLOW_WEBHOOK_SIMULATE", "false").lower() not in ("1", "true", "yes")):
        raise HTTPException(status_code=403, detail="Simulator disabled")
    await _process(payload)
    return {"ok": True}


@router.post("/midtrans/simulate")
async def simulate_midtrans_webhook(payload: dict, req: Request):
    """Dev-only Midtrans webhook simulator (no token required)."""
    if (os.environ.get("ALLOW_WEBHOOK_SIMULATE", "false").lower() not in ("1", "true", "yes")):
        raise HTTPException(status_code=403, detail="Simulator disabled")
    # Map Midtrans-style payload to internal format
    mapped = {
        "reference_id": payload.get("order_id") or payload.get("reference_id"),
        "status": payload.get("transaction_status", payload.get("status", "settlement")).upper(),
    }
    if mapped["status"] in ("SETTLEMENT", "CAPTURE"):
        mapped["status"] = "SUCCEEDED"
    await _process(mapped)
    return {"ok": True}


@router.post("/stripe/simulate")
async def simulate_stripe_webhook(payload: dict, req: Request):
    """Dev-only Stripe webhook simulator (no token required)."""
    if (os.environ.get("ALLOW_WEBHOOK_SIMULATE", "false").lower() not in ("1", "true", "yes")):
        raise HTTPException(status_code=403, detail="Simulator disabled")
    # Map Stripe-style payload to internal format
    mapped = {
        "reference_id": payload.get("payment_intent") or payload.get("reference_id"),
        "status": payload.get("status", "succeeded").upper(),
    }
    if mapped["status"] == "SUCCEEDED":
        mapped["status"] = "SUCCEEDED"
    await _process(mapped)
    return {"ok": True}


# ---------- DOKU ----------
# Single shared URL for every tenant: https://api.dagangos.com/api/webhooks/doku
# Each store's own DOKU merchant account is configured (BYO) to call back here. DOKU's
# inbound Client-Id header tells us which tenant's shared_key to verify the HMAC signature
# against -- nothing from the payload is trusted or acted on until that store's own key
# verifies it. Ported from GerainaOS/backend/routes_webhooks.py.

async def _process_doku(raw_body: bytes, headers: dict):
    db = get_db()
    client_id = headers.get("client-id", "")
    request_id = headers.get("request-id", "")
    timestamp = headers.get("request-timestamp", "")
    signature = headers.get("signature", "")
    if not client_id:
        return

    tenant = await db.integrations.find_one({"doku.client_id": client_id})
    if not tenant:
        return
    doku_cfg = tenant.get("doku") or {}
    if not doku_cfg.get("is_active"):
        return
    shared_key = doku_cfg.get("shared_key") or ""

    ok = verify_doku_signature(
        client_id=client_id,
        request_id=request_id,
        timestamp=timestamp,
        request_target="/api/webhooks/doku",
        raw_body=raw_body,
        shared_key=shared_key,
        incoming_signature=signature,
    )
    if not ok:
        return

    try:
        payload = __import__("json").loads(raw_body or b"{}")
    except Exception:
        return

    invoice_number = (payload.get("order") or {}).get("invoice_number") or payload.get("invoice_number")
    if not invoice_number:
        return
    new_status = map_doku_status(payload)
    await db.orders.update_one(
        {"order_no": invoice_number, "store_id": tenant.get("store_id")},
        {
            "$set": {
                "payment_status": new_status,
                "doku_webhook_payload": payload,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )


@router.post("/doku")
async def doku_webhook(req: Request, background: BackgroundTasks):
    """DOKU always expects a 200 with a specific ack body -- verification failures are
    logged internally (via _process_doku silently discarding), not surfaced as HTTP errors,
    since DOKU will otherwise retry-storm an endpoint that 4xx/5xxs it."""
    raw = await req.body()
    headers = {k.lower(): v for k, v in req.headers.items()}
    background.add_task(_process_doku, raw, headers)
    return {"received": True}


@router.post("/doku/simulate")
async def simulate_doku_webhook(payload: dict, req: Request, store_id: str = ""):
    """Dev-only DOKU webhook simulator (no signature required). Requires an explicit
    store_id (same contract as the real handler's Client-Id tenant resolution above) --
    matching purely by order_no with no store scope at all would be the same cross-tenant
    collision class already fixed for /xendit's handlers, even though order_no now also
    carries a store-hash suffix (see next_order_no in database.py) that makes a same-day
    collision practically impossible on its own."""
    if (os.environ.get("ALLOW_WEBHOOK_SIMULATE", "false").lower() not in ("1", "true", "yes")):
        raise HTTPException(status_code=403, detail="Simulator disabled")
    if not store_id:
        raise HTTPException(status_code=400, detail="store_id wajib diisi untuk simulator")
    db = get_db()
    invoice_number = (payload.get("order") or {}).get("invoice_number") or payload.get("invoice_number")
    if not invoice_number:
        return {"ok": False}
    new_status = map_doku_status(payload)
    await db.orders.update_one(
        {"order_no": invoice_number, "store_id": store_id},
        {"$set": {"payment_status": new_status, "doku_webhook_payload": payload, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True}
