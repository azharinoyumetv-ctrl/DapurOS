import { useEffect, useRef, useState } from "react";
import api, { fmtIDR } from "@/api/client";
import { readCollection } from '@/api/records';
import { inventoryError } from '@/api/inventoryItems';
import useTablePage from '@/hooks/useTablePage';
import TablePage from '@/components/TablePage';
import { CreditCard, Check } from "lucide-react";
import { toast } from "@/components/ui/sonner";

export default function SupplierInvoice() {
  const [invoices, setInvoices] = useState([]);
  const [orders,setOrders]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [form,setForm]=useState({invoice_no:'',po_no:'',amount:'',due_date:new Date().toISOString().slice(0,10)});
  const lock=useRef(false),table=useTablePage(invoices);

  const fetchInvoices = () => {
    readCollection("/purchase/invoices").then((r) => setInvoices(r.data)).catch(e=>setError(inventoryError(e)));
  };

  useEffect(() => {
    fetchInvoices();
    readCollection('/purchase/orders').then(r=>setOrders(r.data)).catch(e=>setError(inventoryError(e)));
  }, []);
  const create=async e=>{
    e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try{await api.post('/purchase/invoices',{...form,invoice_no:form.invoice_no.trim(),amount:Number(form.amount),status:'Unpaid'});setForm({invoice_no:'',po_no:'',amount:'',due_date:new Date().toISOString().slice(0,10)});fetchInvoices();toast.success('Faktur dan utang pemasok telah dicatat.');}
    catch(error){setError(inventoryError(error));}finally{lock.current=false;setBusy(false);}
  };

  const handlePay = (id) => {
    if (!lock.current && confirm("Konfirmasi pembayaran faktur supplier ini?")) {
      lock.current=true;setBusy(true);
      // HISTORY: this used to POST {id, status: "Paid"} straight to the CREATE endpoint,
      // which ignores 'id' and requires invoice_no/po_no/amount/due_date that were never
      // sent -- always 422'd, silently (no .catch()). Real fix: PUT to the invoice's own
      // URL. This exact bug also exists on GerainaOS; fixed there too.
      api.put(`/purchase/invoices/${id}`, { status: "Paid" }).then(() => {
        fetchInvoices();
        toast.success("Faktur berhasil ditandai Lunas!");
      }).catch((err) => {
        toast.error(inventoryError(err));
      }).finally(()=>{lock.current=false;setBusy(false);});
    }
  };

  return (
    <div className="p-8 space-y-6" data-testid="supplier-invoice-page">
      <div>
        <span className="label-tiny">Pembelian</span>
        <h1 className="font-display text-3xl font-bold mt-1">Faktur Supplier</h1>
      </div>

      {error&&<p role="alert" className="text-red-700">{error}</p>}
      <form onSubmit={create} className="card-surface p-5 grid sm:grid-cols-2 gap-4" data-testid="invoice-form">
        <h2 className="sm:col-span-2 font-bold">Catat faktur pemasok</h2>
        <label className="text-sm">Nomor faktur<input className="input-field w-full" aria-label="Nomor faktur" value={form.invoice_no} required maxLength={200} disabled={busy} onChange={e=>setForm(f=>({...f,invoice_no:e.target.value}))}/></label>
        <label className="text-sm">Referensi PO<select className="input-field w-full" aria-label="Referensi PO" value={form.po_no} required disabled={busy} onChange={e=>setForm(f=>({...f,po_no:e.target.value,amount:orders.find(po=>po.po_no===e.target.value)?.total||''}))}><option value="">Pilih PO</option>{orders.map(po=><option key={po.id} value={po.po_no}>{po.po_no} · {po.supplier_name}</option>)}</select></label>
        <label className="text-sm">Jumlah tagihan<input className="input-field w-full" type="number" min="0.01" step="0.01" required aria-label="Jumlah tagihan" value={form.amount} disabled={busy} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}/></label>
        <label className="text-sm">Jatuh tempo<input className="input-field w-full" type="date" required aria-label="Jatuh tempo" value={form.due_date} disabled={busy} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))}/></label>
        <button className="btn-primary" disabled={busy} data-testid="invoice-create">Catat faktur & utang</button>
      </form>
      <div className="card-surface p-6">
        <h2 className="font-display font-bold text-lg mb-4">Tagihan & Faktur Supplier</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">No Invoice</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Referensi PO</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Jumlah Tagihan</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Jatuh Tempo</th>
                <th className="py-3 font-semibold text-[hsl(var(--muted))]">Status</th>
                <th className="py-3 text-right font-semibold text-[hsl(var(--muted))]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {table.rows.map((inv) => {
                const isPaid = inv.status === "Paid";
                const isOverdue = new Date(inv.due_date) < new Date() && !isPaid;
                return (
                  <tr key={inv.id} className="hover:bg-[hsl(var(--background))]/50 transition-colors">
                    <td className="py-3 font-mono font-bold text-xs">{inv.invoice_no}</td>
                    <td className="py-3 font-mono text-xs text-[hsl(var(--muted))]">{inv.po_no}</td>
                    <td className="py-3 font-mono font-semibold">{fmtIDR(inv.amount)}</td>
                    <td className={`py-3 text-xs ${isOverdue ? "text-red-500 font-bold" : "text-[hsl(var(--muted))]"}`}>
                      {inv.due_date} {isOverdue && "(Overdue)"}
                    </td>
                    <td className="py-3">
                      <span className={`pill ${isPaid ? "pill-success" : "pill-warning"}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {!isPaid && (
                        <button disabled={busy} onClick={() => handlePay(inv.id)} className="btn-primary py-1 px-3 text-xs flex items-center gap-1 font-semibold ml-auto">
                          <CreditCard size={12} /> Tandai Lunas
                        </button>
                      )}
                      {isPaid && (
                        <span className="text-emerald-600 text-xs font-semibold flex items-center gap-0.5 justify-end">
                          <Check size={14} /> Terbayar
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-[hsl(var(--muted))]">Belum ada faktur supplier.</td>
                </tr>
              )}
            </tbody>
          </table>
          <TablePage value={table} label="faktur"/>
        </div>
      </div>
    </div>
  );
}
