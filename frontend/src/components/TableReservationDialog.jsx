import { useRef, useState } from 'react';
import api from '@/api/client';

const localInput=value=>{
 if(!value)return '';
 const date=new Date(value);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
};

export default function TableReservationDialog({table,onClose,onSaved}){
 const saved=table.reservation||{},attempt=useRef(null),lock=useRef(false);
 const [form,setForm]=useState({customer_name:saved.customer_name||'',phone:saved.phone||'',party_size:saved.party_size||Math.min(2,table.capacity),arrival_at:localInput(saved.arrival_at),note:saved.note||''});
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const change=(key,value)=>setForm(previous=>({...previous,[key]:value}));
 const submit=async event=>{
  event.preventDefault();if(lock.current)return;
  const body={...form,customer_name:form.customer_name.trim(),party_size:Number(form.party_size),arrival_at:form.arrival_at?new Date(form.arrival_at).toISOString():null,...(saved.id?{expected_reservation_id:saved.id}:{})};
  if(!body.customer_name)return;
  const fingerprint=JSON.stringify(body);if(attempt.current?.fingerprint!==fingerprint)attempt.current={fingerprint,id:crypto.randomUUID()};
  lock.current=true;setBusy(true);setError('');
  try{const {data}=await api.post(`/tables/${table.id}/reservation`,{...body,request_id:attempt.current.id},{timeout:12000});onSaved(data);}
  catch(error){setError(typeof error.response?.data?.detail==='string'?error.response.data.detail:'Reservasi belum dapat dikonfirmasi. Periksa koneksi dan coba lagi; referensi reservasi tetap sama.');}
  finally{lock.current=false;setBusy(false);}
 };
 return <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="reservation-heading" data-testid="reservation-modal">
  <form onSubmit={submit} className="card-surface bg-white p-6 w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto space-y-4">
   <div><span className="pill pill-muted">Business</span><h2 id="reservation-heading" className="font-display text-xl font-bold mt-2">{saved.id?'Ubah reservasi':'Reservasi meja'} · {table.label}</h2><p className="text-sm mt-2 text-[hsl(var(--muted))]">Meja ditahan sejak reservasi disimpan sampai tamu ditempatkan atau reservasi dibatalkan.</p></div>
   <label className="block text-sm">Nama pelanggan<input className="input-field block w-full mt-1" required maxLength={200} autoFocus value={form.customer_name} onChange={e=>change('customer_name',e.target.value)} data-testid="reservation-name"/></label>
   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="block text-sm">Nomor telepon (opsional)<input type="tel" className="input-field block w-full mt-1" maxLength={64} value={form.phone} onChange={e=>change('phone',e.target.value)} data-testid="reservation-phone"/></label><label className="block text-sm">Jumlah tamu<input type="number" className="input-field block w-full mt-1" required min={1} max={table.capacity} step={1} value={form.party_size} onChange={e=>change('party_size',e.target.value)} data-testid="reservation-party-size"/></label></div>
   <label className="block text-sm">Perkiraan kedatangan (opsional)<input type="datetime-local" className="input-field block w-full mt-1" value={form.arrival_at} onChange={e=>change('arrival_at',e.target.value)} data-testid="reservation-arrival"/><span className="block text-xs mt-1 text-[hsl(var(--muted))]">Waktu perangkat: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Meja tetap ditahan bila waktu kedatangan berubah.</span></label>
   <label className="block text-sm">Catatan (opsional)<textarea className="input-field block w-full mt-1" maxLength={1000} value={form.note} onChange={e=>change('note',e.target.value)} data-testid="reservation-note"/></label>
   {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
   <div className="flex flex-wrap gap-3 justify-end"><button className="btn-outline" type="button" disabled={busy} onClick={onClose}>Batal</button><button className="btn-primary" disabled={busy} data-testid="reservation-save">{busy?'Menyimpan…':'Simpan reservasi'}</button></div>
  </form>
 </div>;
}
