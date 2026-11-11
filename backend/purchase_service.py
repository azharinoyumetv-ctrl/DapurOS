from product_scope import product_scope, inventory_scope
"""PO lines and stock receipts share one transaction, including restaurant ingredients."""
import hashlib
import json
from decimal import Decimal
from uuid import uuid4
from fastapi import HTTPException
from database import utcnow
from stock_ledger import movement
from ingredient_units import stock_quantity

def collection(db, kind):
    return db.ingredients if kind=='ingredient' else db.products

def quantity(value, kind):
    if kind=='product' and not float(value).is_integer():
        raise HTTPException(422,'Jumlah produk harus bilangan bulat. Bahan baku boleh memakai pecahan satuan.')
    return float(value) if kind=='ingredient' else int(value)

def inventory_quantity(value, kind, input_unit, record):
    if kind == 'ingredient':
        return stock_quantity(value, input_unit, record.get('unit'))
    if input_unit is not None:
        raise HTTPException(422, 'Satuan konversi hanya tersedia untuk bahan baku.')
    return quantity(value, kind)


async def purchase_lines(db, store_id, items, session):
    if not items:
        raise HTTPException(422,'Tambahkan rincian barang atau bahan baku pada PO.')
    lines=[];seen=set()
    for item in items:
        key=(item.kind,item.product_id)
        if key in seen:
            raise HTTPException(422,'Gabungkan barang yang sama dalam satu baris PO.')
        seen.add(key)
        record=await collection(db,item.kind).find_one(inventory_scope(store_id,item.kind,id=item.product_id),session=session)
        if not record:
            raise HTTPException(404,'Barang atau bahan PO tidak ditemukan di restoran ini.')
        qty=quantity(item.qty,item.kind)
        inventory_quantity(qty, item.kind, item.quantity_unit, record)
        subtotal=(Decimal(str(item.cost))*Decimal(str(qty))).quantize(Decimal('0.01'))
        line = {'product_id':record['id'],'kind':item.kind,'name':record['name'],'qty':qty,'cost':item.cost,'subtotal':float(subtotal),'received_qty':0}
        if item.kind == 'ingredient':
            line['quantity_unit'] = item.quantity_unit or record.get('unit')
        lines.append(line)
    total=sum((Decimal(str(line['subtotal'])) for line in lines),Decimal(0))
    if total>Decimal('1000000000000'):
        raise HTTPException(422,'Total PO melebihi batas yang didukung.')
    return lines,float(total)

async def create_purchase(db, payload, user, session):
    number=payload.po_no.strip();store=user['store_id']
    if not number:raise HTTPException(422,'Nomor PO wajib diisi.')
    items = []
    for item in payload.items:
        line = {'id':item.product_id,'kind':item.kind,'qty':item.qty,'cost':item.cost}
        if item.quantity_unit is not None:
            line['quantity_unit'] = item.quantity_unit
        items.append(line)
    digest=hashlib.sha256(json.dumps({'supplier':payload.supplier_id,'items':items},sort_keys=True).encode()).hexdigest()
    prior=await db.purchase_orders.find_one({'store_id':store,'po_no':number},session=session)
    if prior:
        if prior.get('request_hash')!=digest:raise HTTPException(409,'Nomor PO sudah digunakan untuk rincian berbeda.')
        return {key:value for key,value in prior.items() if key not in ('_id','request_hash')}
    supplier=await db.suppliers.find_one({'store_id':store,'id':payload.supplier_id},session=session)
    if not supplier:
        raise HTTPException(404,'Pemasok tidak ditemukan di restoran ini.')
    lines,total=await purchase_lines(db,store,payload.items,session)
    if Decimal(str(total))!=Decimal(str(payload.total)):
        raise HTTPException(422,'Total PO tidak sesuai rincian barang.')
    identifier=str(uuid4())
    doc={'_id':store+':po:'+hashlib.sha256(number.encode()).hexdigest(),'id':identifier,'store_id':store,
         'po_no':number,'supplier_id':supplier['id'],'supplier_name':supplier['name'],'items':lines,'total':total,
         'status':'Ordered','created_at':utcnow().isoformat(),'created_by':user['id'],'request_hash':digest}
    await db.purchase_orders.insert_one(dict(doc),session=session)
    return {key:value for key,value in doc.items() if key not in ('_id','request_hash')}

async def receive_purchase(db,payload,user,session):
    store=user['store_id'];number=payload.po_no.strip()
    identifier=str(uuid4());at=utcnow().isoformat()
    request_key=payload.request_id or payload.gr_no or identifier
    identity=store+':receiving:'+hashlib.sha256(request_key.encode()).hexdigest()
    items = [item.model_dump(exclude={'quantity_unit'} if item.quantity_unit is None else None) for item in (payload.items or [])]
    fingerprint=hashlib.sha256(json.dumps({'po':number,'items':items or None},sort_keys=True).encode()).hexdigest()
    prior=await db.goods_receiving.find_one({'_id':identity},session=session)
    if prior:
        if prior.get('request_hash')!=fingerprint:
            raise HTTPException(409,'Referensi penerimaan sudah digunakan untuk rincian berbeda.')
        return {key:value for key,value in prior.items() if key!='_id'}
    po=await db.purchase_orders.find_one({'store_id':store,'po_no':number},session=session)
    if not po:
        raise HTTPException(404,'PO tidak ditemukan di restoran ini.')
    if not po.get('items'):
        raise HTTPException(409,'PO lama belum memiliki rincian barang. Lengkapi PO sebelum menerima stok.')
    lines=[dict(line) for line in po['items']]
    if all(line.get('received_qty',0)==line['qty'] for line in lines):
        prior=await db.goods_receiving.find_one({'store_id':store,'po_no':number,'inventory_applied':True},session=session)
        if prior:return {key:value for key,value in prior.items() if key!='_id'}
        raise HTTPException(409,'PO sudah ditutup. Periksa riwayat penerimaan.')
    if po.get('status') not in ('Ordered','Partial'):
        raise HTTPException(409,'Status PO tidak menerima barang baru.')
    if payload.items:
        requested = {(item.kind, item.product_id): (quantity(item.qty, item.kind), item.quantity_unit) for item in payload.items}
    else:
        requested = {(line.get('kind', 'product'), line['product_id']): (float(Decimal(str(line['qty'])) - Decimal(str(line.get('received_qty', 0)))), None)
                     for line in lines if line['qty'] > line.get('received_qty', 0)}
    if payload.items and len(requested)!=len(payload.items):raise HTTPException(422,'Barang penerimaan duplikat.')
    if not requested or set(requested)-{(line.get('kind','product'),line['product_id']) for line in lines}:raise HTTPException(422,'Barang penerimaan tidak ada pada PO.')
    received=[]
    for line in lines:
        kind = line.get('kind', 'product')
        selection = requested.get((kind, line['product_id']))
        if selection is None:
            continue
        qty, input_unit = selection
        scope=inventory_scope(store,kind,id=line['product_id']);target=collection(db,kind)
        record=await target.find_one(scope,session=session)
        if not record:raise HTTPException(409,'Barang atau bahan telah dihapus. Perbaiki rincian PO.')
        po_unit = (line.get('quantity_unit') or record.get('unit')) if kind == 'ingredient' else None
        if input_unit is not None:
            qty = inventory_quantity(qty, kind, input_unit, {'unit': po_unit})
        if Decimal(str(qty)) > Decimal(str(line['qty'])) - Decimal(str(line.get('received_qty', 0))):
            raise HTTPException(409, 'Jumlah diterima melebihi sisa PO.')
        stock_qty = inventory_quantity(qty, kind, po_unit, record)
        await target.update_one(scope,{'$inc':{'stock':stock_qty}},session=session)
        line['received_qty']=float(Decimal(str(line.get('received_qty',0)))+Decimal(str(qty)))
        received.append({'product_id':record['id'],'kind':kind,'name':record['name'],'qty':qty,'cost':line['cost'],
                         'quantity_unit':line.get('quantity_unit') or record.get('unit')})
        await movement(db,session,identifier=f'{identifier}:receiving:{kind}:{record["id"]}',store_id=store,product_id=record['id'],name=record['name'],quantity=stock_qty,reference=number,kind='ingredient_received' if kind=='ingredient' else 'receiving',actor=user['id'],at=at)
    status='Received' if all(line['received_qty']==line['qty'] for line in lines) else 'Partial'
    await db.purchase_orders.update_one({'store_id':store,'id':po['id']},{'$set':{'items':lines,'status':status,'updated_at':at}},session=session)
    doc={'_id':identity,'id':identifier,'store_id':store,'po_no':number,'gr_no':payload.gr_no or 'GR-'+identifier[:8].upper(),
         'received_by':user.get('email') or user['id'],'received_at':at,'items':received,'inventory_applied':True,'request_hash':fingerprint}
    await db.goods_receiving.insert_one(dict(doc),session=session)
    return {key:value for key,value in doc.items() if key!='_id'}
