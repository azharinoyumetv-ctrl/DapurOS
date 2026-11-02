from product_scope import product_scope, inventory_scope
"""Atomic catalogue writes, with restaurant recipe checks and inventory events."""
from uuid import uuid4
from fastapi import HTTPException
from database import utcnow
from plan_limits import check_capacity
from plan_limits import plan_rank
from stock_ledger import movement

async def save_product(db, user, values, session, identifier=None, expected_stock=None):
    store_id=user['store_id'];at=utcnow().isoformat()
    values=dict(values)
    if 'name' in values:
        values['name']=values['name'].strip()
        if not values['name']:
            raise HTTPException(422,'Nama menu wajib diisi.')
    await db.capacity_guards.update_one({'_id':store_id+':products'},{'$inc':{'revision':1}},upsert=True,session=session)
    if values.get('sku'):
        values['sku']=values['sku'].strip()
        existing=await db.products.find_one(product_scope(store_id,sku=values['sku']),session=session)
        if existing and existing.get('id')!=identifier:
            raise HTTPException(409,'SKU sudah digunakan oleh menu lain.')
    if values.get('recipe'):
        if plan_rank(user.get('plan'))<plan_rank('pro'):raise HTTPException(403,'Pengaturan resep tersedia mulai paket Pro.')
        seen=set()
        for item in values['recipe']:
            if item['ingredient_id'] in seen:
                raise HTTPException(422,'Gabungkan bahan yang sama dalam satu baris resep.')
            seen.add(item['ingredient_id'])
            if not await db.ingredients.find_one({'store_id':store_id,'id':item['ingredient_id']},session=session):
                raise HTTPException(409,'Bahan resep tidak ditemukan di restoran ini.')
    if identifier is None:
        await check_capacity(db,store_id,user.get('plan'),'products','max_products')
        identifier=str(uuid4())
        doc={**values,'id':identifier,'store_id':store_id,'module':'dapuros','created_at':at,'updated_at':at,'inventory_ledger_version':1}
        await db.products.insert_one(dict(doc),session=session)
        delta=values.get('stock',0);kind='product_created'
    else:
        doc=await db.products.find_one(product_scope(store_id,id=identifier),session=session)
        if not doc:
            raise HTTPException(404,'Menu tidak ditemukan.')
        if expected_stock is not None and doc.get('stock',0)!=expected_stock:
            raise HTTPException(409,'Stok berubah sejak menu dibuka. Segarkan data sebelum mengubah stok.')
        delta=values.get('stock',doc.get('stock',0))-doc.get('stock',0)
        await db.products.update_one(product_scope(store_id,id=identifier),{'$set':{**values,'updated_at':at}},session=session)
        doc={**doc,**values,'updated_at':at};kind='product_updated'
    await movement(db,session,identifier='product-write:'+str(uuid4()),store_id=store_id,product_id=identifier,name=doc['name'],quantity=delta,reference='MENU-'+identifier[:8].upper(),kind=kind,actor=user['id'],at=at)
    return {key:value for key,value in doc.items() if key!='_id'}
