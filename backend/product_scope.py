"""Retain unlabelled legacy menus while excluding explicit foreign products."""

def product_scope(store_id, **fields):
    return {'store_id':store_id,'module':{'$in':[None,'dapuros']},**fields}


def inventory_scope(store_id,kind,**fields):
    return product_scope(store_id,**fields) if kind=='product' else {'store_id':store_id,**fields}
