import useTablePage from '@/hooks/useTablePage';
import TablePage from '@/components/TablePage';
import { useEffect, useRef, useState } from "react";
import api, { fmtIDR } from "@/api/client";
import { readCollection } from '@/api/records';
import { inventoryError } from '@/api/inventoryItems';
import { Check, ClipboardCheck } from "lucide-react";
import { toast } from "@/components/ui/sonner";

export default function GoodsReceiving() {
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[quantities,setQuantities]=useState({});
  const lock=useRef(false),attempt=useRef(null);
  const [orders, setOrders] = useState([]);
  const [receivings, setReceivings] = useState([]);
  const historyPage=useTablePage(receivings);
  const [selectedPoId, setSelectedPoId] = useState("");

  const fetchData = () => {
    // Get POs that are not yet marked as Received
    readCollection("/purchase/orders").then((r) => {
      const list = r.data || [];
      setOrders(list.filter(po => ['Ordered','Partial'].includes(po.status)));
    }).catch(e=>setError(inventoryError(e)));
    readCollection("/purchase/receiving").then((r) => setReceivings(r.data)).catch(e=>setError(inventoryError(e)));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleReceive = async (po) => {
    if(lock.current)return;
    const items=po.items?.map(line=>({product_id:line.product_id,kind:line.kind||'product',qty:Number(quantities[po.id+':'+line.product_id]??Number((line.qty-(line.received_qty||0)).toFixed(9)))})).filter(line=>line.qty>0);
    if(!items?.length){setError('Isi jumlah barang yang sudah diterima.');return;}
    const payload = {
      po_no: po.po_no,items,
    };
    const fingerprint=JSON.stringify(payload);
    if(attempt.current?.fingerprint!==fingerprint)attempt.current={fingerprint,id:crypto.randomUUID()};
    lock.current=true;setBusy(true);setError('');
    try{
      await api.post('/purchase/receiving',{...payload,request_id:attempt.current.id});attempt.current=null;
      fetchData();
      toast.success(`Barang masuk dari PO ${po.po_no} berhasil diterima dan stok ditambahkan!`);
    }catch(e){setError(inventoryError(e));}finally{lock.current=false;setBusy(false);}
  };

  return (
    <div className="p-8 space-y-6" data-testid="goods-receiving-page">
      <div>
        <span className="label-tiny">Pembelian</span>
        <h1 className="font-display text-3xl font-bold mt-1">Penerimaan Barang</h1>
      </div>

      {error&&<p role="alert" className="text-red-700">{error}</p>}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-5 card-surface p-6 space-y-4">
          <h2 className="font-display font-bold text-lg">Penerimaan Barang Pending</h2>
          <div className="space-y-3">
            {orders.map((po) => (
              <div key={po.id} className="border border-[hsl(var(--border))] rounded-lg p-4 flex flex-col justify-between hover:border-[hsl(var(--primary))] transition-all">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-mono text-xs font-bold text-[hsl(var(--primary))]">{po.po_no}</span>
                    <p className="text-sm font-semibold mt-1">{po.supplier_name}</p>
                  </div>
                  <span className="text-xs font-mono font-bold">{fmtIDR(po.total)}</span>
                </div>
                <div className="space-y-2 mt-3">{po.items?.map(line=><label key={line.product_id} className="flex justify-between gap-2 items-center text-xs">{line.name} · sisa {Number((line.qty-(line.received_qty||0)).toFixed(9))}<input type="number" className="input-field w-24" min="0" max={line.qty-(line.received_qty||0)} step={line.kind==='ingredient'?'any':'1'} aria-label={`Terima ${line.name}`} disabled={busy} value={quantities[po.id+':'+line.product_id]??Number((line.qty-(line.received_qty||0)).toFixed(9))} onChange={e=>setQuantities(q=>({...q,[po.id+':'+line.product_id]:e.target.value}))}/></label>)}{!po.items?.length&&<p className="text-amber-800 text-xs">PO lama belum memiliki rincian barang. Buat PO dengan rincian yang benar sebelum menerima stok.</p>}</div>
                <div className="border-t border-[hsl(var(--border))]/50 pt-2 mt-3 flex justify-between items-center">
                  <span className="text-[10px] text-[hsl(var(--muted))]">Tgl PO: {new Date(po.created_at).toLocaleDateString("id-ID")}</span>
                  <button disabled={busy||!po.items?.length} onClick={() => handleReceive(po)} className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1 font-semibold">
                    <ClipboardCheck size={14} /> Terima Barang
                  </button>
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <p className="text-xs text-[hsl(var(--muted))] text-center py-8">Tidak ada penerimaan PO tertunda.</p>
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7 card-surface p-6" data-testid="receiving-list">
          <h2 className="font-display font-bold text-lg mb-4">Riwayat Penerimaan Barang</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">No Penerimaan</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">No PO</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Tanggal Masuk</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Petugas</th>
                  <th className="py-3 text-right font-semibold text-[hsl(var(--muted))]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {historyPage.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-[hsl(var(--background))]/50 transition-colors">
                    <td className="py-3 font-mono font-semibold text-xs text-[hsl(var(--primary))]">{r.gr_no}</td>
                    <td className="py-3 font-mono text-xs text-[hsl(var(--muted))]">{r.po_no}</td>
                    <td className="py-3 text-xs text-[hsl(var(--muted))]">{new Date(r.received_at).toLocaleString("id-ID")}</td>
                    <td className="py-3 text-xs">{r.received_by}</td>
                    <td className="py-3 text-right">
                      <span className="pill pill-success flex items-center gap-0.5 justify-end w-20 ml-auto">
                        <Check size={10} /> {r.inventory_applied ? 'Diterima' : 'Catatan lama'}
                      </span>
                    </td>
                  </tr>
                ))}
                {receivings.length === 0 && (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-[hsl(var(--muted))]">Belum ada riwayat penerimaan barang.</td>
                  </tr>
                )}
              </tbody>
            </table>
            <TablePage value={historyPage} label="penerimaan"/>
          </div>
        </div>
      </div>
    </div>
  );
}
