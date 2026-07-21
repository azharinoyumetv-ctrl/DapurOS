"""Settings, Payments config, Integrations, and Branch management routes."""
import uuid
from typing import List, Any, Dict
from fastapi import APIRouter, Depends, HTTPException
from database import get_db, utcnow
from models import Branch, BranchBase
from auth import get_current_user, require_admin

router = APIRouter(tags=["settings"])

# ---------- General Settings ----------
@router.get("/api/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.settings.find_one({"store_id": user["store_id"]}, {"_id": 0})
    if not res:
        # Default settings, matching mockDb structure but default to Indonesian locale!
        return {
            "general": { "store_name": user.get("store_name", "Toko Senja"), "currency": "IDR", "timezone": "WIB (UTC+7)", "language": "id" },
            "receipt": { "header_text": "Terima Kasih Telah Berkunjung!", "footer_text": "Powered by DagangOS - Struk Resmi", "show_logo": True, "show_cashier": True },
            "printer": { "default_printer": "Bluetooth 80mm", "paper_size": "80mm", "auto_print": True }
        }
    return res

@router.post("/api/settings")
async def save_settings(payload: Dict[str, Any], user: dict = Depends(require_admin)):
    db = get_db()
    update_data = {k: v for k, v in payload.items() if k not in ("_id", "store_id")}
    res = await db.settings.find_one_and_update(
        {"store_id": user["store_id"]},
        {"$set": update_data},
        upsert=True,
        return_document=True,
        projection={"_id": 0}
    )
    return res

# ---------- Payments Config ----------
@router.get("/api/payments/config")
async def get_payments_config(user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.payments_config.find_one({"store_id": user["store_id"]}, {"_id": 0})
    if not res:
        # Default KOSONG (BYO) — merchant belum konfigurasi apa pun, jangan pura-pura aktif.
        return {
            "cash": { "is_active": True, "provider": "Sistem Kasir Lokal", "require_drawer": False, "active_drawer_port": "" },
            "qris": { "is_active": False, "provider": "Xendit", "type": "dynamic", "merchant_id": "", "callback_status": "Belum Aktif" },
            "ewallet": {
                "is_active": False,
                "provider": "Xendit",
                "channels": {
                    "GoPay": False, "OVO": False, "DANA": False, "ShopeePay": False, "LinkAja": False,
                    "AstraPay": False, "Sakuku": False, "iSaku": False, "MotionPay": False, "JeniusPay": False
                }
            },
            "va": {
                "is_active": False,
                "provider": "Midtrans",
                "banks": {
                    "BCA": False, "BNI": False, "BRI": False, "Mandiri": False, "Permata": False,
                    "CIMB": False, "Maybank": False, "Danamon": False, "Neo": False, "BSI": False
                }
            },
            "credit_card": { "is_active": False, "provider": "Stripe", "enable_3ds": True, "installment_banks": [] },
            "bank_transfer": { "is_active": False, "accounts": [] }
        }
    return res

@router.post("/api/payments/config")
async def save_payments_config(payload: Dict[str, Any], user: dict = Depends(require_admin)):
    qris = payload.get("qris")
    if qris and qris.get("is_active"):
        mid = qris.get("merchant_id")
        if not mid or not str(mid).strip():
            raise HTTPException(status_code=400, detail="Merchant ID wajib diisi")

    db = get_db()
    update_data = {k: v for k, v in payload.items() if k not in ("_id", "store_id")}
    res = await db.payments_config.find_one_and_update(
        {"store_id": user["store_id"]},
        {"$set": update_data},
        upsert=True,
        return_document=True,
        projection={"_id": 0}
    )
    return res

# ---------- Integrations ----------
@router.get("/api/integrations")
async def get_integrations(user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.integrations.find_one({"store_id": user["store_id"]}, {"_id": 0})
    if not res:
        # Default KOSONG (BYO) — merchant isi kredensial sendiri. Tanpa data demo palsu.
        return {
            "xendit": { "is_active": False, "secret_key": "", "webhook_token": "" },
            "midtrans": { "is_active": False, "client_key": "", "server_key": "" },
            "stripe": { "is_active": False, "publishable_key": "", "secret_key": "" },
            "whatsapp": { "is_active": False, "provider": "", "api_token": "", "auto_send_receipt": False },
            "telegram": { "is_active": False, "bot_token": "", "chat_id": "" },
            "email": { "is_active": False, "smtp_host": "", "smtp_port": 587, "smtp_user": "" }
        }
    return res

@router.post("/api/integrations")
async def save_integrations(payload: Dict[str, Any], user: dict = Depends(require_admin)):
    db = get_db()
    update_data = {k: v for k, v in payload.items() if k not in ("_id", "store_id")}
    res = await db.integrations.find_one_and_update(
        {"store_id": user["store_id"]},
        {"$set": update_data},
        upsert=True,
        return_document=True,
        projection={"_id": 0}
    )
    return res

@router.post("/api/integrations/whatsapp/test")
async def test_whatsapp(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    """Kirim pesan tes WhatsApp memakai kredensial yang sedang diisi (tak perlu simpan dulu)."""
    from whatsapp_client import send_whatsapp
    target = str(payload.get("target") or "").strip()
    if not target:
        raise HTTPException(status_code=400, detail="Nomor tujuan wajib diisi")
    token = str(payload.get("api_token") or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="API token WhatsApp belum diisi")
    cfg = {"is_active": True, "provider": payload.get("provider") or "fonnte", "api_token": token}
    return await send_whatsapp(cfg, target, "Tes koneksi WhatsApp DagangOS berhasil.")

# ---------- Tenant Billing & Subscription ----------
@router.get("/api/billing")
@router.get("/api/subscription")
async def get_subscription(user: dict = Depends(get_current_user)):
    # Selalu kembalikan plan ASLI dari akun; abaikan dokumen langganan lama yg bisa berisi
    # data demo ("Enterprise" palsu). Plan per-akun mencakup semua toko.
    plan = (user.get("plan") or "trial").lower()
    return {
        "plan": plan,
        "tier": plan,
        "status": "trial" if plan == "trial" else "active",
        "trial_ends_at": user.get("trial_ends_at"),
        "auto_debit": False,
    }

@router.post("/api/billing")
@router.post("/api/subscription")
async def save_subscription(payload: Dict[str, Any], user: dict = Depends(require_admin)):
    db = get_db()
    update_data = {k: v for k, v in payload.items() if k not in ("_id", "store_id")}
    res = await db.subscription.find_one_and_update(
        {"store_id": user["store_id"]},
        {"$set": update_data},
        upsert=True,
        return_document=True,
        projection={"_id": 0}
    )
    return res

# ---------- Branches ----------
@router.get("/api/branches", response_model=List[Branch])
async def list_branches(user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.branches.find({"store_id": user["store_id"]}, {"_id": 0}).sort("name", 1)
    return await cursor.to_list(length=100)

@router.post("/api/branches", response_model=Branch)
async def create_branch(payload: BranchBase, user: dict = Depends(get_current_user)):
    db = get_db()
    existing = await db.branches.find_one({"store_id": user["store_id"], "name": payload.name})
    if existing:
        raise HTTPException(status_code=400, detail="Cabang/Outlet sudah terdaftar")
    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "name": payload.name,
        "address": payload.address,
        "phone": payload.phone,
        "created_at": utcnow().isoformat()
    }
    await db.branches.insert_one(doc)
    doc.pop("_id", None)
    return doc

@router.put("/api/branches/{branch_id}", response_model=Branch)
async def update_branch(branch_id: str, payload: BranchBase, user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.branches.find_one_and_update(
        {"id": branch_id, "store_id": user["store_id"]},
        {"$set": {
            "name": payload.name,
            "address": payload.address,
            "phone": payload.phone
        }},
        return_document=True,
        projection={"_id": 0}
    )
    if not res:
        raise HTTPException(status_code=404, detail="Cabang tidak ditemukan")
    return res

@router.delete("/api/branches/{branch_id}")
async def delete_branch(branch_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    res = await db.branches.delete_one({"id": branch_id, "store_id": user["store_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cabang tidak ditemukan")
    return {"ok": True}
