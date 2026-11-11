"""Timed reservations in the restaurant's timezone, independent of live table holds."""
import asyncio
import calendar
import hashlib
import json
from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

from database import utcnow
from store_time import store_zone


def parse_local_start(value):
    local = datetime.fromisoformat(value)
    if not 2000 <= local.year <= 2100:
        raise ValueError("Tanggal reservasi tidak valid.")
    return local


MAX_BOOKING_MINUTES = 480


class BookingInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    table_id: str = Field(min_length=1, max_length=200)
    customer_name: str = Field(min_length=1, max_length=200)
    phone: str = Field(default="", max_length=64)
    party_size: int = Field(ge=1, le=1000, strict=True)
    local_start: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$")
    duration_minutes: int = Field(ge=15, le=MAX_BOOKING_MINUTES, strict=True)
    note: str = Field(default="", max_length=1000)
    request_id: UUID

    @field_validator("local_start")
    @classmethod
    def valid_local_start(cls, value):
        parse_local_start(value)
        return value


class BookingEdit(BookingInput):
    expected_version: int = Field(ge=1, strict=True)


def public_booking(row):
    return {key: value for key, value in row.items() if key in {
        "id", "table_id", "table_label", "customer_name", "phone", "party_size", "note",
        "start_at", "end_at", "duration_minutes", "status", "version",
    }}


def instant(local, zone):
    candidates = set()
    for fold in (0, 1):
        candidate = local.replace(tzinfo=zone, fold=fold).astimezone(timezone.utc)
        if candidate.astimezone(zone).replace(tzinfo=None) == local:
            candidates.add(candidate)
    if len(candidates) != 1:
        raise HTTPException(422, "Jam ini ambigu atau tidak tersedia di zona waktu restoran. Pilih jam lain.")
    return candidates.pop()


def day_start(day, zone):
    return datetime.combine(day, time.min, zone).astimezone(timezone.utc).isoformat()


def booking_scope(store_id, identifier):
    return {"_id": f"{store_id}:reservation:{identifier}", "store_id": store_id}


def overlap(start, end):
    return {"start_at": {"$lt": end}, "end_at": {"$gt": start}}


def agenda_overlap(start, end):
    # Reservations can span midnight, but no valid booking can start earlier than this bound.
    bounds = overlap(start, end)
    bounds["start_at"]["$gte"] = (datetime.fromisoformat(start) - timedelta(minutes=MAX_BOOKING_MINUTES)).isoformat()
    return bounds


async def slot_tables(db, store_id, local_start, duration, party_size, exclude):
    zone = await store_zone(db, store_id)
    start = instant(local_start, zone)
    end = start + timedelta(minutes=duration)
    scope = {"store_id": store_id, "status": {"$in": ["booked", "seated"]}, **overlap(start.isoformat(), end.isoformat())}
    if exclude:
        scope["id"] = {"$ne": str(exclude)}
    reads = [
        db.table_bookings.distinct("table_id", scope),
        db.tables.find({"store_id": store_id}, {"_id": 0, "id": 1, "capacity": 1, "status": 1}).to_list(None),
    ]
    if exclude:
        reads.append(db.table_bookings.find_one(booking_scope(store_id, exclude), {"start_at": 1, "table_id": 1}))
    occupied_ids, tables, *excluded = await asyncio.gather(*reads)
    occupied = set(occupied_ids)
    existing = excluded[0] if excluded else None
    unchanged_table = existing["table_id"] if existing and existing["start_at"] == start.isoformat() else None
    now = utcnow()
    return {table["id"]: (
        "Kapasitas kurang" if table.get("capacity", 0) < party_size else
        "Waktu sudah dipesan" if table["id"] in occupied else
        "Meja sedang digunakan" if start <= now and table.get("status", "Vacant") != "Vacant" and table["id"] != unchanged_table else ""
    ) for table in tables}


async def agenda(db, store_id, day):
    zone = await store_zone(db, store_id)
    now = utcnow()
    today = now.astimezone(zone).date()
    day = day or today
    if not 2000 <= day.year <= 2100:
        raise HTTPException(422, "Tanggal kalender tidak valid.")
    month_start = day.replace(day=1)
    month_end = month_start + timedelta(days=calendar.monthrange(day.year, day.month)[1])
    start, end = day_start(day, zone), day_start(day + timedelta(days=1), zone)
    scope = {"store_id": store_id}
    rows, tables, month = await asyncio.gather(
        db.table_bookings.find({**scope, **agenda_overlap(start, end)}).sort("start_at", 1).limit(501).to_list(501),
        db.tables.find(scope, {"_id": 0, "id": 1, "label": 1, "capacity": 1, "status": 1, "floor_id": 1}).sort("label", 1).to_list(None),
        db.table_bookings.find(
            {**scope, **agenda_overlap(day_start(month_start, zone), day_start(month_end, zone)),
             "status": {"$in": ["booked", "seated"]}},
            {"_id": 0, "start_at": 1, "end_at": 1},
        ).limit(5001).to_list(5001),
    )
    if len(rows) > 500:
        raise HTTPException(409, "Terlalu banyak reservasi untuk hari ini.")
    labels = {table["id"]: table["label"] for table in tables}
    marked_days = set()
    for row in month[:5000]:
        first = datetime.fromisoformat(row["start_at"]).astimezone(zone).date()
        last = (datetime.fromisoformat(row["end_at"]) - timedelta(microseconds=1)).astimezone(zone).date()
        cursor = max(first, month_start)
        while cursor <= last and cursor < month_end:
            marked_days.add(cursor.isoformat())
            cursor += timedelta(days=1)
    return {
        "timezone": zone.key, "today": today.isoformat(), "day": day.isoformat(), "server_now": now.isoformat(),
        "tables": tables, "marked_days": sorted(marked_days),
        "bookings": [public_booking({**row, "table_label": labels.get(row["table_id"], row["table_label"])}) for row in rows],
    }


async def current_booking(db, store_id, table_id, session, *, exclude=None):
    now = utcnow().isoformat()
    scope = {"store_id": store_id, "table_id": table_id, "status": "booked",
             "start_at": {"$lte": now}, "end_at": {"$gt": now}}
    if exclude:
        scope["id"] = {"$ne": exclude}
    return await db.table_bookings.find_one(scope, session=session)


async def upcoming(db, store_id, table_id, session, *, minimum_party=None):
    scope = {"store_id": store_id, "table_id": table_id, "status": "booked", "end_at": {"$gt": utcnow().isoformat()}}
    if minimum_party is not None:
        scope["party_size"] = {"$gt": minimum_party}
    return await db.table_bookings.find_one(scope, session=session)


async def save(db, user, payload, session, identifier=None):
    store_id = user["store_id"]
    key = booking_scope(store_id, identifier or str(payload.request_id))
    current = await db.table_bookings.find_one(key, session=session)
    digest = hashlib.sha256(json.dumps({"actor": user["id"], **payload.model_dump(mode="json")}, sort_keys=True).encode()).hexdigest()
    if current and (current.get("created_hash") if identifier is None else current.get("edit_hash")) == digest:
        return public_booking(current)
    if identifier is None and current:
        raise HTTPException(409, "Referensi ini sudah digunakan untuk reservasi lain.")
    if identifier is not None:
        if not current:
            raise HTTPException(404, "Reservasi tidak ditemukan.")
        if current["status"] != "booked" or current["version"] != payload.expected_version:
            raise HTTPException(409, "Reservasi sudah berubah. Segarkan kalender.")

    zone = await store_zone(db, store_id)
    start = instant(parse_local_start(payload.local_start), zone)
    end = start + timedelta(minutes=payload.duration_minutes)
    now = utcnow()
    same_slot = current and current["start_at"] == start.isoformat()
    if (start < now.replace(second=0, microsecond=0) and not same_slot) or end <= now:
        raise HTTPException(422, "Pilih waktu reservasi sekarang atau yang akan datang.")
    table_ids = {payload.table_id}
    if current:
        table_ids.add(current["table_id"])
    table = None
    for table_id in sorted(table_ids):
        scope = {"store_id": store_id, "id": table_id}
        # Serialize conflicting bookings and live table changes on the same table document.
        row = await db.tables.find_one_and_update(scope, {"$inc": {"session_revision": 1}}, session=session)
        if table_id == payload.table_id:
            table = row
    if not table:
        raise HTTPException(404, "Meja tidak ditemukan.")
    if payload.party_size > table.get("capacity", 0):
        raise HTTPException(422, "Jumlah tamu melebihi kapasitas meja.")
    if start <= now and table.get("status", "Vacant") != "Vacant" and not (same_slot and current["table_id"] == payload.table_id):
        raise HTTPException(409, "Meja sedang digunakan. Pilih meja atau waktu lain.")
    start_iso, end_iso = start.isoformat(), end.isoformat()
    conflicts = {"store_id": store_id, "table_id": payload.table_id, "status": {"$in": ["booked", "seated"]},
                 **overlap(start_iso, end_iso)}
    if current:
        conflicts["_id"] = {"$ne": current["_id"]}
    if await db.table_bookings.find_one(conflicts, session=session):
        raise HTTPException(409, "Waktu bertabrakan dengan reservasi lain untuk meja ini.")
    fields = {
        "table_id": payload.table_id, "table_label": table["label"], "customer_name": payload.customer_name,
        "phone": payload.phone, "party_size": payload.party_size, "note": payload.note,
        "start_at": start_iso, "end_at": end_iso, "duration_minutes": payload.duration_minutes,
        "updated_at": now.isoformat(), "updated_by": user["id"],
    }
    if current:
        updates = {**fields, "version": current["version"] + 1, "edit_hash": digest}
        await db.table_bookings.update_one(key, {"$set": updates}, session=session)
        return public_booking({**current, **updates})
    doc = {**key, **fields, "id": str(payload.request_id), "status": "booked", "version": 1,
           "created_at": now.isoformat(), "created_by": user["id"], "created_hash": digest}
    await db.table_bookings.insert_one(dict(doc), session=session)
    return public_booking(doc)


async def close_booking(db, user, identifier, version, status, session):
    key = booking_scope(user["store_id"], identifier)
    row = await db.table_bookings.find_one(key, session=session)
    if not row:
        raise HTTPException(404, "Reservasi tidak ditemukan.")
    if row["status"] == status:
        return public_booking(row)
    if row["status"] != "booked" or row["version"] != version:
        raise HTTPException(409, "Reservasi sudah berubah. Segarkan kalender.")
    now = utcnow().isoformat()
    if status == "no_show" and now < row["start_at"]:
        raise HTTPException(409, "Tandai tidak hadir setelah jam kedatangan.")
    await db.tables.update_one({"store_id": user["store_id"], "id": row["table_id"]},
                               {"$inc": {"session_revision": 1}}, session=session)
    updates = {"status": status, "version": version + 1, "updated_at": now, "updated_by": user["id"]}
    await db.table_bookings.update_one(key, {"$set": updates}, session=session)
    return public_booking({**row, **updates})


async def seat(db, user, table, identifier, version, session):
    key = booking_scope(user["store_id"], identifier)
    row = await db.table_bookings.find_one(key, session=session)
    if not row or row["table_id"] != table["id"] or row["status"] != "booked" or row["version"] != version:
        raise HTTPException(409, "Reservasi atau meja sudah berubah. Segarkan kalender.")
    now = utcnow()
    if not datetime.fromisoformat(row["start_at"]) - timedelta(minutes=15) <= now < datetime.fromisoformat(row["end_at"]):
        raise HTTPException(409, "Tamu dapat ditempatkan mulai 15 menit sebelum jadwal hingga akhir reservasi.")
    if table.get("status", "Vacant") != "Vacant" or table.get("reservation"):
        raise HTTPException(409, "Meja sedang digunakan atau ditahan. Selesaikan layanan saat ini atau ubah meja reservasi.")
    if await current_booking(db, user["store_id"], table["id"], session, exclude=identifier):
        raise HTTPException(409, "Meja masih dijadwalkan untuk reservasi lain.")
    await db.table_bookings.update_one(key, {"$set": {
        "status": "seated", "updated_at": now.isoformat(), "updated_by": user["id"],
    }, "$inc": {"version": 1}}, session=session)
    return {**public_booking(row), "arrival_at": row["start_at"], "version": version + 1, "status": "seated", "scheduled": True}
