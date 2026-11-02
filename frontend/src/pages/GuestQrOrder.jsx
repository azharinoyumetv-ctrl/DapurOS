import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '@/api/client';

const money=value=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value);
const statusLabel={pending:'Belum dibayar · bayar di kasir',paid:'Pembayaran telah tercatat',voided:'Pesanan dibatalkan',failed:'Pesanan belum dapat diproses'};
function savedAttempt(token){
 try{const value=JSON.parse(sessionStorage.getItem('dapuros_guest_order:'+token));
  return value&&Array.isArray(value.cart)&&value.cart.length>0&&value.cart.length<=20&&value.cart.every(x=>typeof x?.id==='string'&&typeof x.name==='string'&&Number.isFinite(x.price)&&x.price>=0&&Number.isInteger(x.quantity)&&x.quantity>=1&&x.quantity<=20&&typeof x.note==='string'&&x.note.length<=500)&&/^[0-9a-f-]{36}$/i.test(value.attempt?.id||'')&&typeof value.attempt.fingerprint==='string'?value:null;
 }catch{return null;}
}
export default function GuestQrOrder(){
 const token=new URLSearchParams(window.location.search).get('token')||'';
 const restored=useRef(savedAttempt(token));
 const [menu,setMenu]=useState(null),[products,setProducts]=useState([]),[cart,setCart]=useState(restored.current?.cart||[]),[q,setQ]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[uncertain,setUncertain]=useState(!!restored.current),[order,setOrder]=useState(null);
 const lock=useRef(false),attempt=useRef(restored.current?.attempt||null);
 const clearSaved=()=>{try{sessionStorage.removeItem('dapuros_guest_order:'+token);}catch{}};
 const remember=()=>{try{sessionStorage.setItem('dapuros_guest_order:'+token,JSON.stringify({attempt:attempt.current,cart:cart.map(({id,name,price,quantity,note})=>({id,name,price,quantity,note}))}));}catch{}};
 async function request(path,options={}){
  const response=await fetch(API_BASE+'/public/qr/'+encodeURIComponent(token)+path,{cache:'no-store',credentials:'omit',...options,headers:{'X-DagangOS-Module':'dapuros',...options.headers}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok){const e=new Error(typeof body.detail==='string'?body.detail:'Menu belum dapat diperiksa. Coba lagi atau hubungi staf.');e.status=response.status;throw e;}
  return body;
 }
 async function load(append=false,recover=false){
  if(uncertain&&!recover)return;
  setLoading(true);setError('');
  try{
   const params=new URLSearchParams({q});if(append&&menu?.next_cursor)params.set('cursor',menu.next_cursor);
   const data=await request('?'+params);setMenu(data);setProducts(previous=>append?[...previous,...data.items]:data.items);
   if(recover&&restored.current){
    try{const saved=await request('/orders/'+attempt.current.id);setOrder(saved);setCart([]);setUncertain(false);}
    catch{setError('Periksa pesanan sebelumnya. Jika belum ditemukan, kirim ulang dengan referensi yang sama.');}
   }else if(!append){setCart([]);attempt.current=null;clearSaved();}
  }catch(e){setError(e.message);}finally{setLoading(false);}
 }
 useEffect(()=>{if(!/^[a-f0-9]{64}$/.test(token)){setLoading(false);setError('QR tidak valid. Minta QR terbaru kepada staf.');return;}load(false,true);},[token]);
 useEffect(()=>{
  if(!order||!attempt.current||['paid','voided','failed'].includes(order.status))return;
  const timer=setInterval(()=>request('/orders/'+attempt.current.id).then(setOrder).catch(()=>{}),6000);
  return()=>clearInterval(timer);
 },[order?.reference,order?.status]);
 useEffect(()=>{if(menu)document.title=`${menu.restaurant} · ${menu.table}`;},[menu?.restaurant,menu?.table]);
 const update=(product,delta)=>{
  if(busy||uncertain)return;
  setCart(items=>{const found=items.find(x=>x.id===product.id);if(!found)return delta>0?[...items,{...product,quantity:1,note:''}]:items;
   return items.map(x=>x.id===product.id?{...x,quantity:Math.min(20,x.quantity+delta)}:x).filter(x=>x.quantity>0);});
 };
 const subtotal=cart.reduce((sum,x)=>sum+x.price*x.quantity,0),service=Math.round(subtotal*0.05*100)/100,tax=Math.round((subtotal+service)*0.10*100)/100;
 async function send(){
  if(lock.current||!cart.length||!menu?.session_active)return;
  lock.current=true;setBusy(true);setError('');
  const items=cart.map(x=>({product_id:x.id,quantity:x.quantity,expected_price:x.price,note:x.note}));
  const fingerprint=JSON.stringify(items);
  if(attempt.current?.fingerprint!==fingerprint)attempt.current={id:crypto.randomUUID(),fingerprint};
  remember();
  try{
   const result=await request('/orders',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':attempt.current.id},body:JSON.stringify({items})});
   setOrder(result);setCart([]);setUncertain(false);
  }catch(e){setError(e.message);setUncertain(!e.status||e.status>=500);if(e.status&&e.status<500)clearSaved();}finally{setBusy(false);lock.current=false;}
 }
 return <main className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] px-4 py-6" data-testid="guest-menu-page">
  <div className="max-w-3xl mx-auto space-y-5">
   <header className="space-y-1"><p className="text-xs font-bold text-[hsl(var(--primary))]">DapurOS · Menu meja</p><h1 className="font-display text-2xl font-bold">{menu?.restaurant||'Menu restoran'}</h1>{menu&&<p>{menu.table} · Bayar di kasir</p>}</header>
   {error&&<section role="alert" className="card-surface p-4 space-y-3" data-testid="guest-menu-error"><p>{error}</p><button className="btn-outline" disabled={loading||busy} onClick={()=>uncertain?send():load()}>{uncertain?'Coba kirim lagi':'Perbarui menu'}</button>{uncertain&&<p className="text-sm">Pesanan belum dapat dikonfirmasi. Keranjang tetap disimpan; pengiriman ulang memakai referensi yang sama.</p>}</section>}
   {order?<section className="card-surface p-5 space-y-3" data-testid="guest-order-success"><h2 className="text-xl font-bold">Pesanan diterima</h2><p data-testid="guest-order-reference">{order.reference}</p><p className="font-bold">{money(order.total)}</p><p data-testid="guest-order-status">{statusLabel[order.status]||'Silakan hubungi staf'}</p><button className="btn-primary" onClick={()=>{setOrder(null);attempt.current=null;load();}}>Tambah pesanan</button></section>:<>
    {menu&&!menu.session_active&&<p role="status" className="card-surface p-4">Meja belum dibuka. Minta staf membuka sesi meja sebelum mengirim pesanan.</p>}
    <form className="flex gap-2" onSubmit={event=>{event.preventDefault();load();}}><input className="input-field flex-1" aria-label="Cari menu" value={q} disabled={busy||uncertain} onChange={e=>setQ(e.target.value)} placeholder="Cari menu restoran"/><button className="btn-outline" disabled={loading||busy||uncertain}>Cari</button></form>
    {loading&&<p role="status">Memuat menu…</p>}
    <section className="grid grid-cols-1 sm:grid-cols-2 gap-3" aria-label="Menu restoran">{products.map(product=><article key={product.id} className="card-surface p-4 space-y-2" data-testid={`guest-product-${product.id}`}>
     {product.image_url&&/^(https?:\/\/|data:image\/(png|jpeg|webp|gif);base64,)/.test(product.image_url)&&<img src={product.image_url} alt="" referrerPolicy="no-referrer" loading="lazy" className="w-full h-32 object-cover rounded-lg"/>}
     <p className="text-xs text-[hsl(var(--muted))]">{product.category}</p><h2 className="font-bold">{product.name}</h2><p>{product.description}</p><p className="font-semibold">{money(product.price)}</p>
     <button className="btn-primary" disabled={!product.available||busy||uncertain} onClick={()=>update(product,1)} data-testid={`guest-add-${product.id}`}>{product.available?'Tambah':'Habis'}</button>
    </article>)}</section>
    {!loading&&menu&&!products.length&&<p className="card-surface p-4">Menu belum tersedia. Silakan hubungi staf.</p>}
    {menu?.next_cursor&&<button className="btn-outline w-full" disabled={loading||uncertain} onClick={()=>load(true)}>Muat menu lainnya</button>}
    {!!cart.length&&<section className="card-surface p-5 space-y-4" data-testid="guest-cart"><h2 className="text-lg font-bold">Pesanan Anda</h2>{cart.map(item=><div key={item.id} className="border-b border-[hsl(var(--border))] pb-3 space-y-2"><div className="flex items-center justify-between gap-2"><span>{item.name}</span><div className="flex items-center gap-3"><button className="btn-outline" disabled={busy||uncertain} aria-label={`Kurangi ${item.name}`} onClick={()=>update(item,-1)}>−</button><span>{item.quantity}</span><button className="btn-outline" disabled={busy||uncertain||item.quantity>=20} aria-label={`Tambah ${item.name}`} onClick={()=>update(item,1)}>+</button></div></div><input className="input-field w-full" aria-label={`Catatan ${item.name}`} placeholder="Catatan pesanan (opsional)" maxLength={500} disabled={busy||uncertain} value={item.note} onChange={e=>setCart(items=>items.map(x=>x.id===item.id?{...x,note:e.target.value}:x))}/></div>)}
     <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div><div className="flex justify-between"><span>Layanan 5%</span><span>{money(service)}</span></div><div className="flex justify-between"><span>Pajak 10%</span><span>{money(tax)}</span></div><div className="flex justify-between font-bold"><span>Total</span><span data-testid="guest-cart-total">{money(subtotal+service+tax)}</span></div>
     <button className="btn-primary w-full" disabled={busy||!menu?.session_active} onClick={send} data-testid="guest-send-order">{busy?'Mengirim pesanan…':uncertain?'Coba kirim lagi':'Kirim pesanan ke dapur'}</button><p className="text-xs">Pembayaran dilakukan di kasir setelah pesanan diperiksa.</p>
    </section>}
   </>}
  </div>
 </main>;
}
