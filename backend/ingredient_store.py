"""Ingredient edits retain stock conflict checks and recipe references."""
from uuid import uuid4
from fastapi import HTTPException
from database import utcnow
from stock_ledger import movement
from ingredient_units import stock_quantity


def convert_stock_inputs(values, base_unit, input_unit):
    for field in ("stock", "safety_stock"):
        if field in values:
            values[field] = stock_quantity(values[field], input_unit, base_unit)


async def save(db,user,values,session,identifier=None,expected_stock=None):
    store=user['store_id'];values=dict(values);at=utcnow().isoformat()
    input_unit = values.pop('quantity_unit', None)
    for field in ('name','unit'):
        if field in values:
            values[field]=values[field].strip()
            if not values[field] or len(values[field])>(200 if field=='name' else 40):raise HTTPException(422,'Nama dan satuan bahan wajib diisi dengan benar.')
    await db.capacity_guards.update_one({'_id':store+':products'},{'$inc':{'revision':1}},upsert=True,session=session)
    if values.get('name'):
        existing=await db.ingredients.find_one({'store_id':store,'name':values['name']},session=session)
        if existing and existing['id']!=identifier:raise HTTPException(409,'Nama bahan baku sudah digunakan.')
    if identifier:
        scope={'store_id':store,'id':identifier};record=await db.ingredients.find_one(scope,session=session)
        if not record:raise HTTPException(404,'Bahan baku tidak ditemukan.')
        if expected_stock is not None and record['stock']!=expected_stock:raise HTTPException(409,'Stok bahan telah berubah. Muat ulang sebelum mengubah stok.')
        if 'unit' in values and values['unit']!=record['unit'] and await db.products.find_one({'store_id':store,'recipe.ingredient_id':identifier},session=session):raise HTTPException(409,'Satuan bahan masih digunakan dalam resep. Perbarui resep sebelum mengganti satuan.')
        if 'unit' in values and values['unit'] != record['unit']:
            pending = {'store_id': store, 'items.product_id': identifier}
            if (await db.stock_transfers.find_one({**pending, 'status': 'Shipped'}, session=session)
                    or await db.purchase_orders.find_one({**pending, 'status': {'$in': ['Ordered', 'Partial']}}, session=session)):
                raise HTTPException(409, 'Selesaikan transfer atau PO sebelum mengganti satuan bahan.')
        convert_stock_inputs(values, values.get('unit', record['unit']), input_unit)
        delta=values.get('stock',record['stock'])-record['stock']
        await db.ingredients.update_one(scope,{'$set':{**values,'updated_at':at}},session=session)
        record={**record,**values,'updated_at':at}
    else:
        convert_stock_inputs(values, values['unit'], input_unit)
        identifier=str(uuid4());record={**values,'id':identifier,'store_id':store,'created_at':at,'updated_at':at}
        delta=values.get('stock',0)
        await db.ingredients.insert_one(dict(record),session=session)
    await movement(db,session,identifier='ingredient-write:'+str(uuid4()),store_id=store,product_id=identifier,name=record['name'],quantity=delta,reference='BAHAN-'+identifier[:8].upper(),kind='ingredient_updated' if expected_stock is not None else 'ingredient_created',actor=user['id'],at=at)
    return {key:value for key,value in record.items() if key!='_id'}


async def remove(db,user,identifier,session):
    store=user['store_id']
    await db.capacity_guards.update_one({'_id':store+':products'},{'$inc':{'revision':1}},upsert=True,session=session)
    if await db.products.find_one({'store_id':store,'recipe.ingredient_id':identifier},session=session):raise HTTPException(409,'Bahan masih digunakan dalam resep. Hapus dari resep terlebih dahulu.')
    # Unreceived inventory cannot disappear while a transfer is in transit.
    if await db.stock_transfers.find_one({'store_id':store,'status':'Shipped','items.product_id':identifier,'inventory_applied':True},session=session):raise HTTPException(409,'Bahan masih dalam pengiriman. Selesaikan transfer terlebih dahulu.')
    if await db.purchase_orders.find_one({'store_id':store,'status':{'$in':['Ordered','Partial']},'items.product_id':identifier},session=session):raise HTTPException(409,'Bahan masih ada pada PO yang belum diterima penuh.')
    result=await db.ingredients.delete_one({'store_id':store,'id':identifier},session=session)
    if not result.deleted_count:raise HTTPException(404,'Bahan baku tidak ditemukan.')
