"""DB connection + helpers."""
import hashlib
import os
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient

_client = None
_db = None


import logging

logger = logging.getLogger("geraina.database")

def get_db():
    global _client, _db
    if _db is None:
        mongo_url = os.environ["MONGO_URL"].strip()
        db_name = os.environ["DB_NAME"].strip()
        logger.info(f"Initializing AsyncIOMotorClient. MONGO_URL length: {len(mongo_url)}, DB_NAME: {db_name}")
        _client = AsyncIOMotorClient(mongo_url)
        _db = _client[db_name]
    return _db


def close_db():
    global _client
    if _client is not None:
        _client.close()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def trial_end_iso(days: int = 14) -> str:
    return (utcnow() + timedelta(days=days)).isoformat()


async def next_order_no(store_id: str) -> str:
    """Increment order counter per store, generate order no like GR-A1B2-20260108-0001.

    The 4-char hex suffix is a short hash of store_id. order_no is the public token that
    payment webhooks (e.g. Xendit) match against to flip payment_status — without a
    store-specific component here, two different stores could get an identical order_no
    on the same day (both counters reset daily), letting a webhook for one store's payment
    mark a different store's order as paid. The suffix makes that collision practically
    impossible while keeping the string short enough for a receipt.
    """
    db = get_db()
    today = utcnow().strftime("%Y%m%d")
    key = f"{store_id}:{today}"
    res = await db.counters.find_one_and_update(
        {"_id": key},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = res.get("seq", 1) if res else 1
    store_suffix = hashlib.sha1(store_id.encode()).hexdigest()[:4].upper()
    return f"GR-{store_suffix}-{today}-{seq:04d}"
