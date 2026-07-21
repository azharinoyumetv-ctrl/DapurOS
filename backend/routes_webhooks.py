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
