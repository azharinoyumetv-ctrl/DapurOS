"""Pricing tiers (static, public) — FINAL pricing per client spec.

DO NOT modify prices without explicit client approval.
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from auth import get_billing_user, require_billing_admin
from database import get_db, utcnow

router = APIRouter(prefix="/api/pricing", tags=["pricing"])

TIERS = [
    {
        "id": "trial",
        "name": "Free Trial",
        "price_idr_monthly": 0,
        "price_idr_yearly": 0,
        "period_monthly": "14 hari",
        "period_yearly": "14 hari",
        "tagline": "14 hari, akses penuh fitur Business",
        "max_outlets": 3,
        "max_employees": 75,
        "max_products": None,
        "max_tables": None,
        "max_devices": 24,
        "features": [
            "Semua fitur paket Business",
            "3 outlet, device & akun setara Business",
            "Tanpa kartu kredit",
            "Bisa berhenti kapan saja",
        ],
        "cta": "Mulai Trial",
        "highlight": False,
    },
    {
        "id": "starter",
        "name": "Starter",
        "price_idr_monthly": 249000,
        "price_idr_yearly": 2490000,
        "period_monthly": "/bulan",
        "period_yearly": "/tahun",
        "tagline": "Operasional dasar restoran",
        "max_outlets": 1,
        "max_employees": 5,
        "max_products": 150,
        "max_tables": 25,
        "max_devices": 2,
        "features": [
            "1 outlet, 2 device, 5 akun karyawan",
            "Maks 150 menu, 25 meja, transaksi unlimited",
            "POS restoran, dine-in & takeaway",
            "Peta meja interaktif",
            "KDS dasar + catatan pesanan & modifier",
            "Split bill",
            "Tunai + catat manual pembayaran digital",
            "Struk thermal + laporan penjualan dasar",
        ],
        "cta": "Pilih Starter",
        "highlight": False,
    },
    {
        "id": "pro",
        "name": "Pro",
        "price_idr_monthly": 499000,
        "price_idr_yearly": 4990000,
        "period_monthly": "/bulan",
        "period_yearly": "/tahun",
        "tagline": "Restoran lengkap 1 outlet",
        "max_outlets": 1,
        "max_employees": 25,
        "max_products": None,
        "max_tables": None,
        "max_devices": 8,
        "features": [
            "1 outlet, 8 device, 25 akun karyawan",
            "Menu & meja unlimited",
            "QR self-order di meja",
            "Multi-KDS + filter stasiun dapur",
            "Resep & BOM bahan + potong stok otomatis",
            "Purchase order + faktur supplier",
            "QRIS + e-wallet otomatis",
            "Piutang, utang & import Excel/CSV",
            "Laporan penjualan, stok, laba rugi & pajak",
        ],
        "cta": "Pilih Pro",
        "highlight": False,
    },
    {
        "id": "business",
        "name": "Business",
        "price_idr_monthly": 749000,
        "price_idr_yearly": 7490000,
        "period_monthly": "/bulan",
        "period_yearly": "/tahun",
        "tagline": "Kontrol penuh, siap multi-outlet",
        "highlight_note": "Semua fitur operasional, otomatisasi, dan multi-outlet dalam satu paket.",
        "max_outlets": 3,
        "max_employees": 75,
        "max_products": None,
        "max_tables": None,
        "max_devices": 24,
        "features": [
            "3 outlet, 24 device, 75 akun karyawan",
            "Manajemen menu & resep terpusat",
            "Transfer stok bahan antar outlet",
            "Laporan konsolidasi + food-cost per outlet",
            "Membership + loyalty",
            "Absensi karyawan + role lanjutan",
            "Integrasi WhatsApp otomatis",
            "Webhook & monitoring piutang/utang terpusat",
        ],
        "cta": "Pilih Business",
        "highlight": True,
        "badge": "Nilai Terbaik",
    },
]

ADDONS = [
    {"id": "extra_device", "name": "Perangkat kasir/KDS tambahan", "price_idr": 49000, "unit": "/bulan, khusus Pro (maks 2 device)"},
    {"id": "extra_outlet", "name": "Outlet tambahan", "price_idr": 199000, "unit": "/bulan, khusus Business — termasuk 8 device & 25 akun karyawan"},
]


@router.get("/tiers")
async def list_tiers():
    return TIERS


@router.get("/addons")
async def list_addons():
    return ADDONS


# Paket yang boleh diaktifkan mandiri tanpa pembayaran (gratis).
# Paket berbayar dikunci sampai gateway pembayaran (Xendit/Midtrans) aktif.
FREE_SELF_SERVE_TIERS = {"trial"}


@router.post("/upgrade")
async def upgrade_plan(payload: dict, user: dict = Depends(require_billing_admin)):
    tier_id = payload.get("tier_id")
    if not tier_id or tier_id not in [t["id"] for t in TIERS]:
        raise HTTPException(status_code=400, detail="Paket tidak valid")
    if tier_id not in FREE_SELF_SERVE_TIERS:
        raise HTTPException(
            status_code=403,
            detail="Aktivasi paket berbayar belum tersedia. Pembayaran sedang disiapkan — silakan hubungi sales untuk aktivasi manual.",
        )

    db = get_db()
    await db.users.find_one_and_update(
        {"id": user["id"]},
        {"$set": {"plan": tier_id}}
    )
    await db.stores.find_one_and_update(
        {"id": user["store_id"]},
        {"$set": {"plan": tier_id}}
    )
    return {"ok": True, "plan": tier_id}


@router.get("/addons/my")
async def list_my_addons(user: dict = Depends(get_billing_user)):
    """This store's addon purchase requests (pending/active/rejected), newest first. Uses
    get_billing_user (not get_current_user) so this stays reachable on an expired trial --
    see require_billing_admin below for why."""
    db = get_db()
    cursor = db.addon_purchases.find({"store_id": user["store_id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(length=100)


@router.post("/addons/purchase")
async def purchase_addon(payload: dict, user: dict = Depends(require_billing_admin)):
    """No subscription payment gateway is wired to this app's own billing (only to in-store
    POS transactions via Xendit/DOKU/EDC), so this records a pending request for manual
    activation by DagangOS staff after payment is confirmed offline -- same reasoning as
    GerainaOS's addon endpoint (mirrored here; DapurOS's own /upgrade above just rejects paid
    tiers outright with no record kept, which is fine for the tier-change UI's "hubungi sales"
    messaging but not good enough for a purchase flow meant to actually be fulfilled later).

    Once a request is flipped to status="active" (manually, in the DB, by staff), it takes
    effect automatically -- plan_limits.py's check_capacity()/check_outlet_capacity() read
    active addon_purchases and add the bonus capacity on top of the plan's base caps. See
    _active_addon_counts()/_addon_bonus() there. No separate "apply the addon" step needed.

    Uses require_billing_admin (not require_admin) so this stays reachable on an expired
    trial -- though in practice plan != "pro"/"business" below already rejects an expired
    account from buying an addon anyway; they have to /upgrade first regardless."""
    addon_id = payload.get("addon_id")
    addon = next((a for a in ADDONS if a["id"] == addon_id), None)
    if not addon:
        raise HTTPException(status_code=400, detail="Add-on tidak valid")

    plan = user.get("plan")
    if addon_id == "extra_device" and plan != "pro":
        raise HTTPException(status_code=400, detail="Add-on device tambahan khusus untuk paket Pro.")
    if addon_id == "extra_outlet" and plan != "business":
        raise HTTPException(status_code=400, detail="Add-on outlet tambahan khusus untuk paket Business.")

    db = get_db()
    if addon_id == "extra_device":
        existing = await db.addon_purchases.count_documents({
            "store_id": user["store_id"], "addon_id": "extra_device", "status": {"$in": ["pending", "active"]},
        })
        if existing >= 2:
            raise HTTPException(status_code=400, detail="Maksimal 2 device tambahan per toko (sudah tercapai).")

    doc = {
        "id": str(uuid.uuid4()),
        "store_id": user["store_id"],
        "addon_id": addon_id,
        "requested_by": user["id"],
        "requested_by_email": user.get("email"),
        "status": "pending",
        "created_at": utcnow().isoformat(),
    }
    await db.addon_purchases.insert_one(doc)
    return {
        "ok": True,
        "status": "pending_manual_activation",
        "message": f"Permintaan add-on \"{addon['name']}\" tercatat. Tim kami akan mengaktifkannya secara manual setelah pembayaran dikonfirmasi.",
    }
