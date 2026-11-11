"""Calculate portions and ingredient balances with the same rules at checkout."""
from decimal import Decimal, InvalidOperation
from math import ulp


def stock_decimal(value):
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal(0)
    return result if result.is_finite() else Decimal(0)


def recipe_requirements(recipe):
    requirements = {}
    for row in recipe:
        if not isinstance(row, dict):
            raise ValueError('Invalid recipe row')
        identifier = row.get('ingredient_id')
        quantity = stock_decimal(row.get('quantity', row.get('qty')))
        if not isinstance(identifier, str) or not identifier or quantity <= 0:
            raise ValueError('Invalid ingredient or quantity')
        requirements[identifier] = requirements.get(identifier, Decimal(0)) + quantity
    return requirements


def stock_remaining(stock, required):
    remaining = stock - required
    # Older checkouts used binary subtraction. Snap a near-zero remainder only
    # within a few representable steps of the original nonzero balance.
    if stock > 0 and abs(remaining) <= Decimal(str(4 * ulp(float(stock)))):
        return Decimal(0)
    return remaining


def portions(requirements, ingredients):
    limits = []
    for identifier, per_portion in requirements.items():
        balance = stock_decimal(ingredients.get(identifier, {}).get('stock'))
        if balance <= 0:
            return 0
        if balance >= per_portion * 1_000_000_000:
            limits.append(1_000_000_000)
            continue
        count = int(balance // per_portion)
        if stock_remaining(balance, per_portion * (count + 1)) >= 0:
            count += 1
        limits.append(count)
    return min(limits, default=0)


async def recipe_portions(db, store_id, products, session=None):
    recipes = {}
    for product in products:
        recipe = product.get('recipe')
        if recipe:
            try:
                recipes[product['id']] = recipe_requirements(recipe)
            except (TypeError, ValueError):
                recipes[product['id']] = {}
    identifiers = {identifier for recipe in recipes.values() for identifier in recipe}
    ingredients = {}
    if identifiers:
        rows = await db.ingredients.find(
            {'store_id': store_id, 'id': {'$in': list(identifiers)}},
            {'_id': 0, 'id': 1, 'stock': 1}, session=session,
        ).to_list(None)
        ingredients = {row['id']: row for row in rows}
    return {identifier: portions(recipe, ingredients) for identifier, recipe in recipes.items()}
