"""Idempotent inventory events written in the same transaction as their source."""
async def movement(db, session, *, identifier, store_id, product_id, name, quantity,
                   reference, kind, actor, at, branch_id='main', reconstructed=False):
    if not quantity:
        return
    await db.stock_movements.update_one({'_id': identifier}, {'$setOnInsert': {
        'id': identifier, 'store_id': store_id, 'product_id': product_id,
        'product_name': name, 'quantity': quantity, 'reference': reference,
        'kind': kind, 'actor_id': actor, 'created_at': at, 'branch_id': branch_id,
        'reconstructed': reconstructed,
    }}, upsert=True, session=session)


async def sale_events(db,session,*,order_id,store_id,line,reference,kind,actor,at):
    """Recipe inventory is measured in ingredient units, never finished-menu units."""
    entries=line.get('ingredient_deductions') or []
    direction=-1 if kind=='sale' else 1
    if entries:
        for entry in entries:
            ingredient=await db.ingredients.find_one({'store_id':store_id,'id':entry['ingredient_id']},session=session) or {}
            await movement(db,session,identifier=f"{order_id}:{kind}:{line['product_id']}:{entry['ingredient_id']}",store_id=store_id,
                product_id=entry['ingredient_id'],name=ingredient.get('name') or entry.get('name') or 'Bahan resep',quantity=direction*entry['quantity'],
                reference=reference,kind='ingredient_'+kind,actor=actor,at=at)
    else:
        await movement(db,session,identifier=f"{order_id}:{kind}:{line['product_id']}",store_id=store_id,product_id=line['product_id'],name=line['name'],
            quantity=direction*line['quantity'],reference=reference,kind=kind,actor=actor,at=at)
