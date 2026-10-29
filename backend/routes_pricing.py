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
FREE_SELF_SERVE_TIERS = set()


@router.post("/upgrade")
async def upgrade_plan(payload: dict, user: dict = Depends(require_billing_admin)):
    """Trials begin once at product activation; paid plans need verified checkout."""
    if payload.get("tier_id") not in {tier["id"] for tier in TIERS}:
        raise HTTPException(400, "Paket tidak valid")
    raise HTTPException(409, "Trial hanya dimulai saat aktivasi produk. Pilih paket berbayar melalui Langganan & Tagihan atau halaman Harga.")

@router.get("/addons/my")
async def list_my_addons(user: dict = Depends(get_billing_user)):
    """This store's addon purchase requests (pending/active/rejected), newest first. Uses
    get_billing_user (not get_current_user) so this stays reachable on an expired trial --
    see require_billing_admin below for why."""
    db = get_db()
    cursor = db.addon_purchases.find({"store_id": user["store_id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(length=100)


@router.post('/addons/purchase')
async def purchase_addon(payload: dict, user: dict = Depends(require_billing_admin)):
    raise HTTPException(409, 'Pembelian add-on melalui checkout terverifikasi. Buka Langganan & Tagihan untuk melanjutkan.')
