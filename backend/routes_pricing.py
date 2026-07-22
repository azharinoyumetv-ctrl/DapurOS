"""Pricing tiers (static, public) — FINAL pricing per client spec.

DO NOT modify prices without explicit client approval.
"""
from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user, require_admin
from database import get_db

router = APIRouter(prefix="/api/pricing", tags=["pricing"])

TIERS = [
    {
        "id": "trial",
        "name": "Free Trial",
        "price_idr_monthly": 0,
        "price_idr_yearly": 0,
        "period_monthly": "14 hari",
        "period_yearly": "14 hari",
        "tagline": "1 outlet, coba semua fitur Pro",
        "features": [
            "1 outlet, 1 kasir",
            "Maks 100 menu",
            "Unlimited transaksi",
            "Akses fitur Pro (KDS, QR menu, split bill)",
            "Tanpa kartu kredit",
        ],
        "cta": "Mulai Trial",
        "highlight": False,
    },
    {
        "id": "starter",
        "name": "Starter",
        "price_idr_monthly": 99000,
        "price_idr_yearly": 990000,
        "period_monthly": "/bulan",
        "period_yearly": "/tahun",
        "tagline": "Warung makan/kedai kecil",
        "features": [
            "1 outlet, 1 kasir",
            "Hingga 500 menu",
            "Split bill per item",
            "QRIS + e-wallet (OVO/DANA/ShopeePay/LinkAja)",
            "Struk otomatis via WhatsApp",
            "Support email",
        ],
        "cta": "Pilih Starter",
        "highlight": False,
    },
    {
        "id": "pro",
        "name": "Pro",
        "price_idr_monthly": 249000,
        "price_idr_yearly": 2490000,
        "period_monthly": "/bulan",
        "period_yearly": "/tahun",
        "tagline": "Restoran/kafe — paling banyak dipilih",
        "features": [
            "1 outlet, hingga 3 kasir",
            "Menu unlimited + import Excel/CSV",
            "Kitchen Display System (KDS)",
            "QR menu meja untuk dine-in",
            "EDC + DOKU + QRIS + e-wallet",
            "Support prioritas (chat)",
        ],
        "cta": "Pilih Pro",
        "highlight": True,
        "badge": "Paling Direkomendasikan",
    },
    {
        "id": "business",
        "name": "Business",
        "price_idr_monthly": 499000,
        "price_idr_yearly": 4990000,
        "period_monthly": "/bulan",
        "period_yearly": "/tahun",
        "tagline": "Restoran besar, multi-kasir",
        "features": [
            "1 outlet, kasir unlimited",
            "Purchase order & faktur supplier",
            "Laporan multi-shift",
            "Custom branding struk + invoice A4",
            "Analytics lanjutan",
            "Support prioritas 7×12",
        ],
        "cta": "Pilih Business",
        "highlight": False,
    },
    {
        "id": "multibranch",
        "name": "Multi-Branch",
        "price_idr_monthly": 799000,
        "price_idr_yearly": None,
        "period_monthly": "/bulan, mulai dari",
        "period_yearly": "Custom",
        "tagline": "Multi-cabang/multi-outlet",
        "features": [
            "Unlimited outlet",
            "Konsolidasi laporan antar cabang",
            "Transfer stok bahan antar cabang",
            "Dedicated success manager",
            "SLA & on-premise option",
            "Training on-site",
        ],
        "cta": "Hubungi Sales",
        "highlight": False,
    },
]

ADDONS = [
    {"id": "extra_device", "name": "Perangkat kasir/KDS tambahan", "price_idr": 49000, "unit": "/bulan"},
    {"id": "extra_branch", "name": "Cabang tambahan", "price_idr": 199000, "unit": "/bulan"},
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
async def upgrade_plan(payload: dict, user: dict = Depends(require_admin)):
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
