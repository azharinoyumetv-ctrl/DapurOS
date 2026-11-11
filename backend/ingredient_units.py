"""Convert stock inputs without changing the unit used by existing recipes."""
from decimal import Decimal

from fastapi import HTTPException


MASS = {"mg": 1, "g": 1000, "kg": 1_000_000, "t": 1_000_000_000}
VOLUME = {"ml": 1, "cl": 10, "dl": 100, "l": 1000}
ALIASES = {
    "miligram": "mg", "gram": "g", "gr": "g", "kilogram": "kg", "kilo": "kg",
    "ton": "t", "tonne": "t", "mililiter": "ml", "milliliter": "ml",
    "sentiliter": "cl", "desiliter": "dl", "liter": "l", "litre": "l", "ltr": "l",
}
MAX_STOCK = Decimal("1000000000")


def normalize_unit(unit):
    value = (unit or "").strip().casefold()
    return ALIASES.get(value, value)


def convert_quantity(value, source, destination):
    """Return a Decimal in the destination unit. Count units only match themselves."""
    source, destination = normalize_unit(source), normalize_unit(destination)
    amount = Decimal(str(value))
    if source == destination:
        return amount
    for family in (MASS, VOLUME):
        if source in family and destination in family:
            return amount * family[source] / family[destination]
    raise HTTPException(422, "Satuan jumlah tidak sesuai dengan satuan bahan baku.")


def stock_quantity(value, source, destination):
    amount = convert_quantity(value, destination if source is None else source, destination)
    if not 0 <= amount <= MAX_STOCK or (amount > 0 and float(amount) == 0):
        raise HTTPException(422, "Jumlah dalam satuan bahan baku di luar batas yang didukung.")
    return float(amount)
