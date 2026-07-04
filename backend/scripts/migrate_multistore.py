"""Migrasi ke model multi-store (Fase 1).

Idempotent. Default DRY-RUN (hanya menampilkan rencana). Tambahkan --apply untuk eksekusi.

Yang dilakukan:
  1. Set `stores.module` untuk store yang belum punya (default: dapuros).
  2. Set `stores.owner_user_id` dari user yang store_id-nya cocok (jika belum ada).
  3. Pastikan `plan`/`trial_ends_at` ada di akun (users) — hanya mengisi jika kosong.
  4. Hapus akun STAF backdoor lama di `users` (role Manager/Cashier/Warehouse) — staf kini
     dikelola per-toko, bukan akun platform. Owner TIDAK dihapus.
  5. (Opsional, --wipe-demo) Kosongkan data demo (products, categories, brands, memberships,
     suppliers, dst.) agar toko mulai bersih.

Cara pakai:
  MONGO_URL="..." DB_NAME="dagangos" python migrate_multistore.py            # dry-run
  MONGO_URL="..." DB_NAME="dagangos" python migrate_multistore.py --apply    # eksekusi
  ... --apply --wipe-demo   # sekaligus bersihkan data demo
  ... --apply --default-module geraina   # ubah default modul store lama
"""
import os
import sys
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

APPLY = "--apply" in sys.argv
WIPE_DEMO = "--wipe-demo" in sys.argv
DEFAULT_MODULE = "dapuros"
for i, a in enumerate(sys.argv):
    if a == "--default-module" and i + 1 < len(sys.argv):
        DEFAULT_MODULE = sys.argv[i + 1].lower()

STAFF_ROLES = {"Manager", "Cashier", "Warehouse", "manager", "cashier", "warehouse"}
DEMO_COLLECTIONS = [
    "products", "categories", "brands", "memberships", "loyalty_rules",
    "suppliers", "purchase_orders", "goods_receiving", "supplier_invoices",
    "stock_adjustments", "stock_transfers", "branches",
]


async def main():
    mongo = os.environ.get("MONGO_URL", "").strip()
    dbname = os.environ.get("DB_NAME", "dagangos").strip()
    if not mongo:
        print("ERROR: set MONGO_URL (dan DB_NAME) environment variable.")
        sys.exit(1)

    client = AsyncIOMotorClient(mongo)
    db = client[dbname]
    mode = "APPLY" if APPLY else "DRY-RUN"
    print(f"== Migrasi multi-store [{mode}] db={dbname} default_module={DEFAULT_MODULE} wipe_demo={WIPE_DEMO} ==\n")

    # 1 + 2: stores.module & owner_user_id
    stores = await db.stores.find({}).to_list(length=100000)
    n_mod = n_owner = 0
    for s in stores:
        updates = {}
        if not s.get("module"):
            updates["module"] = DEFAULT_MODULE
        if not s.get("owner_user_id"):
            owner = await db.users.find_one({"store_id": s["id"]})
            if owner:
                updates["owner_user_id"] = owner["id"]
        if updates:
            if "module" in updates:
                n_mod += 1
            if "owner_user_id" in updates:
                n_owner += 1
            if APPLY:
                await db.stores.update_one({"id": s["id"]}, {"$set": updates})
    print(f"[1] stores set module      : {n_mod}")
    print(f"[2] stores set owner_user_id: {n_owner}")

    # 3: pastikan plan/trial di akun
    n_plan = 0
    async for u in db.users.find({"role": {"$in": ["Owner", "owner", "admin"]}}):
        upd = {}
        if not u.get("plan"):
            upd["plan"] = "trial"
        if upd:
            n_plan += 1
            if APPLY:
                await db.users.update_one({"id": u["id"]}, {"$set": upd})
    print(f"[3] akun diisi plan default : {n_plan}")

    # 4: hapus akun staf backdoor
    staff_users = await db.users.find({"role": {"$in": list(STAFF_ROLES)}}).to_list(length=100000)
    print(f"[4] akun staf (non-owner) akan dihapus: {len(staff_users)}")
    for su in staff_users[:20]:
        print(f"      - {su.get('email')} (role={su.get('role')})")
    if APPLY and staff_users:
        res = await db.users.delete_many({"role": {"$in": list(STAFF_ROLES)}})
        print(f"      -> dihapus: {res.deleted_count}")

    # 5: opsional wipe demo
    if WIPE_DEMO:
        print("[5] wipe data demo:")
        for coll in DEMO_COLLECTIONS:
            cnt = await db[coll].count_documents({})
            print(f"      {coll}: {cnt}")
            if APPLY:
                await db[coll].delete_many({})
    else:
        print("[5] wipe demo: dilewati (tambahkan --wipe-demo untuk mengaktifkan)")

    print("\nSelesai." + ("" if APPLY else "  (DRY-RUN — tidak ada perubahan. Tambahkan --apply.)"))
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
