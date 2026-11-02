"""Xendit API client -- BYO per-tenant credentials, v3 Payment Request API.

HISTORY (credentials): this used to read a single global XENDIT_SECRET_KEY env
var, shared across every store, while the Settings > Integrasi UI told
merchants "use your own Xendit key -- transactions go to your own account."
Those two things were both true and incompatible: a merchant's own key, once
saved, was written to integrations.xendit.secret_key and then never read by
anything -- the actual charge calls only ever consulted the env var. Converted
to the same per-store BYO pattern as doku_client.py/EDC/WhatsApp: credentials
come from the calling store's own integrations.xendit config.

HISTORY (API version): this used to call Xendit's older, separate /qr_codes
and /ewallets/charges endpoints. Confirmed against Xendit's own current
OpenAPI spec (Payments v3) that neither endpoint appears there at all --
the current, documented integration path is the unified Payment Request API
(POST /v3/payment_requests, one shape for every channel via channel_code).
Migrated to that. Confirmed per-channel details (channel_code strings,
channel_properties fields, response action descriptor) against
docs.xendit.co's individual channel pages (QRIS, OVO, LinkAja) rather than
assuming the old codes/shapes still applied -- e.g. e-wallet channel codes
dropped their "ID_" prefix (OVO not ID_OVO), and OVO no longer needs a
mobile_number in channel_properties (v3 OVO is REDIRECT/SKIP like the other
e-wallets, not the old phone-linked flow).
"""
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import httpx

XENDIT_BASE = "https://api.xendit.co"
PAYMENT_REQUESTS_PATH = "/v3/payment_requests"

# Confirmed via docs.xendit.co/docs/{qris,ovo,linkaja} etc -- plain channel_code,
# no "ID_" prefix in the v3 Payment Request API (unlike the old /ewallets/charges API).
EWALLET_CHANNELS = {"OVO", "DANA", "SHOPEEPAY", "LINKAJA"}


class PaymentNotConfiguredError(Exception):
    """No real payment provider key configured (production, BYO not set up)."""
    pass




def _require_configured(cfg: Dict[str, Any], purpose: str) -> None:
    if not cfg.get("is_active") or not (cfg.get("secret_key") or "").strip():
        raise PaymentNotConfiguredError(
            f"Xendit belum dikonfigurasi. Tambahkan API key Xendit toko Anda di Pengaturan → Integrasi untuk menerima {purpose}."
        )


async def _create_payment_request(cfg: Dict[str, Any], payload: Dict[str, Any]) -> Dict[str, Any]:
    key = (cfg.get("secret_key") or "").strip()
    auth = httpx.BasicAuth(key, "")
    async with httpx.AsyncClient(base_url=XENDIT_BASE, auth=auth, timeout=20) as c:
        r = await c.post(PAYMENT_REQUESTS_PATH, json=payload)
        if r.status_code >= 400:
            raise httpx.HTTPStatusError(f"Xendit {r.status_code}: {r.text}", request=r.request, response=r)
        return r.json()


def _first_action_value(res: Dict[str, Any], descriptor: str) -> Optional[str]:
    """v3 responses carry the QR string / redirect URL inside an actions[] array,
    e.g. [{"type": "PRESENT_TO_CUSTOMER", "descriptor": "QR_STRING", "value": "..."}].
    Defensive: an unexpected/missing shape returns None rather than raising --
    same lesson as the DOKU response-parsing incident earlier this session."""
    try:
        for action in res.get("actions") or []:
            if isinstance(action, dict) and action.get("descriptor") == descriptor:
                return action.get("value")
    except Exception:
        pass
    return None


# ---------- QRIS (dynamic, single-use) ----------
async def create_qris(cfg: Dict[str, Any], external_id: str, amount: int, currency: str = "IDR") -> Dict[str, Any]:
    """cfg = the store's integrations.xendit dict: {is_active, secret_key, webhook_token}."""
    if type(amount) is not int or not 0 < amount <= 10_000_000 or currency != "IDR":
        raise PaymentNotConfiguredError("Nominal QRIS harus dalam Rupiah, lebih dari nol dan maksimal Rp10.000.000.")
    _require_configured(cfg, "QRIS")
    payload = {
        "reference_id": external_id,
        "type": "PAY",
        "country": "ID",
        "currency": currency,
        "request_amount": amount,
        "capture_method": "AUTOMATIC",
        "channel_code": "QRIS",
        "channel_properties": {
            # QRIS payment requests expire after 48h per Xendit's channel spec --
            # set it explicitly rather than relying on their default.
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=48)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        },
    }
    res = await _create_payment_request(cfg, payload)
    qr = _first_action_value(res, "QR_STRING")
    if (not isinstance(res, dict) or not res.get("payment_request_id") or
            not isinstance(qr, str) or not qr.strip()):
        raise PaymentNotConfiguredError("Xendit tidak mengembalikan kode QR pembayaran. Periksa aktivasi kanal QRIS.")
    res["qr_string"] = qr
    return res


# ---------- E-Wallet (OVO / DANA / SHOPEEPAY / LINKAJA) ----------
async def create_ewallet_charge(
    cfg: Dict[str, Any],
    reference_id: str,
    amount: int,
    channel_code: str,
    customer_phone: Optional[str] = None,
    customer_email: Optional[str] = None,
    success_url: Optional[str] = None,
    failure_url: Optional[str] = None,
    currency: str = "IDR",
) -> Dict[str, Any]:
    """cfg = the store's integrations.xendit dict: {is_active, secret_key, webhook_token}.
    channel_code is the plain v3 code: OVO | DANA | SHOPEEPAY | LINKAJA (no ID_ prefix)."""

    _require_configured(cfg, "e-wallet")
    payload = {
        "reference_id": reference_id,
        "type": "PAY",
        "country": "ID",
        "currency": currency,
        "request_amount": amount,
        "capture_method": "AUTOMATIC",
        "channel_code": channel_code,
        "channel_properties": {
            "success_return_url": success_url or "https://dagangos.com/dapuros/app/pos",
            "failure_return_url": failure_url or "https://dagangos.com/dapuros/app/pos",
        },
    }
    res = await _create_payment_request(cfg, payload)
    res.setdefault("checkout_url", _first_action_value(res, "WEB_URL"))
    return res
