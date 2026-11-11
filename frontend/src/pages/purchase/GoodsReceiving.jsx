import IngredientUnitSelect from "@/components/IngredientUnitSelect";
import { convertIngredientQuantity } from "@/lib/ingredientUnits";
import useTablePage from '@/hooks/useTablePage';
import TablePage from '@/components/TablePage';
import { useEffect, useRef, useState } from "react";
import api, { fmtIDR } from "@/api/client";
import { readCollection } from '@/api/records';
import { inventoryError } from '@/api/inventoryItems';
import { Check, ClipboardCheck } from "lucide-react";
import { toast } from "@/components/ui/sonner";

const lineKey = (po, line) => [po.id, line.kind || 'product', line.product_id].join(':');
const remainingQuantity = line => Number((line.qty - (line.received_qty || 0)).toPrecision(15));

export default function GoodsReceiving() {
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[quantities,setQuantities]=useState({});
  const lock=useRef(false),attempt=useRef(null);
  const [quantityUnits, setQuantityUnits] = useState({});
  const [ingredients, setIngredients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [receivings, setReceivings] = useState([]);
  const historyPage=useTablePage(receivings);
  const [selectedPoId, setSelectedPoId] = useState("");

  const fetchData = () => {
    // Get POs that are not yet marked as Received
    readCollection("/purchase/orders").then((r) => {
      const list = r.data || [];
      const pending = list.filter(po => ['Ordered','Partial'].includes(po.status));
      setOrders(pending);
      if (pending.some(po => po.items?.some(line => line.kind === 'ingredient' && !line.quantity_unit))) {
        readCollection('/ingredients').then(response => setIngredients(response.data)).catch(() => {});
      }
    }).catch(e=>setError(inventoryError(e)));
    readCollection("/purchase/receiving").then((r) => setReceivings(r.data)).catch(e=>setError(inventoryError(e)));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const orderUnit = line => line.kind === 'ingredient'
    ? line.quantity_unit || ingredients.find(ingredient => ingredient.id === line.product_id)?.unit
    : undefined;

  const receiveQuantity = (po, line) => {
    const key = lineKey(po, line);
    const base = orderUnit(line);
    return quantities[key] ?? convertIngredientQuantity(remainingQuantity(line), base, quantityUnits[key] || base);
  };

  const changeUnit = (po, line, unit) => {
    const key = lineKey(po, line);
    setQuantities(values => ({ ...values,
      [key]: convertIngredientQuantity(receiveQuantity(po, line), quantityUnits[key] || orderUnit(line), unit),
    }));
    setQuantityUnits(values => ({ ...values, [key]: unit }));
  };

  const handleReceive = async (po) => {
    if(lock.current)return;
    const items = po.items?.map(line => ({
      product_id: line.product_id, kind: line.kind || 'product',
      qty: Number(receiveQuantity(po, line)),
      quantity_unit: quantityUnits[lineKey(po, line)] || undefined,
    })).filter(line => line.qty > 0);
    if(!items?.length){setError('Isi jumlah barang yang sudah diterima.');return;}
    const payload = {
      po_no: po.po_no,items,
    };
    const fingerprint=JSON.stringify(payload);
    if(attempt.current?.fingerprint!==fingerprint)attempt.current={fingerprint,id:crypto.randomUUID()};
    lock.current=true;setBusy(true);setError('');
    try{
      await api.post('/purchase/receiving',{...payload,request_id:attempt.current.id});attempt.current=null;
      const retainOtherOrders = values => Object.fromEntries(Object.entries(values).filter(([key]) => !key.startsWith(po.id + ':')));
      setQuantities(retainOtherOrders);
      setQuantityUnits(retainOtherOrders);
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
                <div className="space-y-2 mt-3">
                  {po.items?.map(line => {
                    const key = lineKey(po, line);
                    const base = orderUnit(line);
                    const remaining = remainingQuantity(line);
                    return <div key={key} className="space-y-2">
                      <p className="text-xs">{line.name} · sisa {remaining} {base}</p>
                      {remaining > 0 && <div className="grid grid-cols-2 gap-2 items-end">
                        <label className="block">
                          <span className="label-tiny">Terima {line.name}</span>
                          <input type="number" className="input-field mt-1" min="0"
                            max={convertIngredientQuantity(remaining, base, quantityUnits[key] || base)}
                            step={line.kind === 'ingredient' ? 'any' : '1'}
                            aria-label={`Terima ${line.name}`} disabled={busy} value={receiveQuantity(po, line)}
                            onChange={event => setQuantities(values => ({ ...values, [key]: event.target.value }))} />
                        </label>
                        <IngredientUnitSelect base={base} value={quantityUnits[key]} onChange={unit => changeUnit(po, line, unit)}
                          label={`Satuan terima ${line.name}`} disabled={busy} />
                      </div>}
                    </div>;
                  })}
                  {!po.items?.length && <p className="text-amber-800 text-xs">PO lama belum memiliki rincian barang. Buat PO dengan rincian yang benar sebelum menerima stok.</p>}
                </div>
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
