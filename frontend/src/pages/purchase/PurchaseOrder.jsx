import IngredientUnitSelect from "@/components/IngredientUnitSelect";
import useTablePage from '@/hooks/useTablePage';
import TablePage from '@/components/TablePage';
import { useEffect, useRef, useState } from "react";
import api, { fmtIDR } from "@/api/client";
import { readCollection } from '@/api/records';
import { loadInventoryItems, inventoryError } from '@/api/inventoryItems';
import { Plus, Check, ListRestart } from "lucide-react";
import { toast } from "@/components/ui/sonner";

export default function PurchaseOrder() {
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  const lock=useRef(false),attempt=useRef(null);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const orderPage=useTablePage(orders);

  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [quantityUnit, setQuantityUnit] = useState("");
  const selectedIngredient = products.find(item => item.key === productId && item.kind === "ingredient");
  const [cost, setCost] = useState("");
  const [poItems, setPoItems] = useState([]);

  const fetchData = () => {
    readCollection('/suppliers').then(r=>setSuppliers(r.data)).catch(e=>setError(inventoryError(e)));
    loadInventoryItems('pro').then(setProducts).catch(e=>setError(inventoryError(e)));
    readCollection('/purchase/orders').then(r=>setOrders(r.data)).catch(e=>setError(inventoryError(e)));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddItem = (e) => {
    e.preventDefault();
    if (busy || !productId || !Number.isFinite(Number(qty)) || Number(qty)<=0 || cost==='' || !Number.isFinite(Number(cost)) || Number(cost)<0) return;

    const prod = products.find(p => p.key === productId);
    if (!prod) return;

    const newItem = {
      product_id: prod.id, kind: prod.kind,
      name: prod.name,
      qty: Number(qty),
      quantity_unit: selectedIngredient ? quantityUnit || selectedIngredient.unit : undefined,
      cost: Number(cost),
      subtotal: Math.round(Number(qty)*Number(cost)*100)/100
    };

    if(poItems.some(it=>it.product_id===prod.id&&it.kind===prod.kind)){setError('Barang sudah ada pada PO. Hapus baris lama untuk mengganti jumlah.');return;}
    setError('');setPoItems([...poItems, newItem]);
    setProductId("");
    setQuantityUnit("");
    setQty("");
    setCost("");
  };

  const handleCreatePO = async () => {
    if (lock.current || !supplierId || poItems.length === 0) return;

    const sup = suppliers.find(s => s.id === supplierId);
    if (!sup) return;

    const total = Math.round(poItems.reduce((sum, item) => sum + item.subtotal, 0) * 100) / 100;

    const payload = {
      supplier_id: supplierId,
      supplier_name: sup.name,
      items: poItems,
      total,
      status: "Ordered",
    };
    const fingerprint=JSON.stringify(payload);
    if(attempt.current?.fingerprint!==fingerprint)attempt.current={fingerprint,number:'PO-'+crypto.randomUUID().slice(0,12).toUpperCase()};
    lock.current=true;setBusy(true);setError('');
    try {
      await api.post('/purchase/orders',{...payload,po_no:attempt.current.number});attempt.current=null;
      setSupplierId("");
      setPoItems([]);
      fetchData();
      toast.success("Purchase Order berhasil diterbitkan!");
    }catch(e){setError(inventoryError(e));}finally{lock.current=false;setBusy(false);}
  };

  return (
    <div className="p-8 space-y-6" data-testid="purchase-orders-page">
      <div>
        <span className="label-tiny">Pembelian</span>
        <h1 className="font-display text-3xl font-bold mt-1">Order Pembelian</h1>
      </div>

      {error&&<p role="alert" className="text-red-700">{error}</p>}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-5 card-surface p-6 space-y-4">
          <h2 className="font-display font-bold text-lg">Buat PO Baru</h2>
          
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase" htmlFor="po-supplier">Pilih Supplier</label>
            <select
              id="po-supplier" value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
            >
              <option value="">-- Pilih Supplier --</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="border-t border-[hsl(var(--border))] pt-4">
            <h3 className="text-xs font-bold text-[hsl(var(--muted))] uppercase mb-3">Tambah Item Barang</h3>
            <form onSubmit={handleAddItem} className="space-y-3">
              <div className="flex flex-col space-y-1">
                <label className="text-[10px] font-semibold text-[hsl(var(--muted))] uppercase" htmlFor="po-item">Produk</label>
                <select
                  id="po-item" value={productId}
                  onChange={(e) => {
                    setProductId(e.target.value);
                    setQuantityUnit("");
                    setQty("");
                    const prod = products.find(p => p.key === e.target.value);
                    if (prod) setCost(prod.cost || "");
                  }}
                  className="border border-[hsl(var(--border))] rounded-md px-3 py-1.5 bg-white text-[hsl(var(--foreground))] outline-none text-xs"
                >
                  <option value="">-- Pilih Produk --</option>
                  {products.map(p => (
                    <option key={p.key} value={p.key}>{p.name} ({p.kind==='ingredient'?'Bahan baku · '+p.unit:'Produk'} | Cost: {fmtIDR(p.cost)})</option>
                  ))}
                </select>
              </div>
              <IngredientUnitSelect base={selectedIngredient?.unit} value={quantityUnit} onChange={setQuantityUnit} />
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-semibold text-[hsl(var(--muted))] uppercase" htmlFor="po-qty">Jumlah</label>
                  <input
                    type="number"
                    id="po-qty" value={qty} min={productId.startsWith('ingredient:')?'0.000001':'1'} step={productId.startsWith('ingredient:')?'any':'1'} required
                    onChange={(e) => setQty(e.target.value)}
                    placeholder="Contoh: 100"
                    className="border border-[hsl(var(--border))] rounded-md px-3 py-1.5 bg-white text-[hsl(var(--foreground))] outline-none text-xs"
                  />
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-semibold text-[hsl(var(--muted))] uppercase" htmlFor="po-unit-price">Harga per {quantityUnit || selectedIngredient?.unit || "unit"}</label>
                  <input
                    type="number"
                    id="po-unit-price" value={cost} min="0" step="0.01" required
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="Rp"
                    className="border border-[hsl(var(--border))] rounded-md px-3 py-1.5 bg-white text-[hsl(var(--foreground))] outline-none text-xs"
                  />
                </div>
              </div>
              <button type="submit" className="btn-outline w-full py-1.5 text-xs flex items-center justify-center gap-2">
                <Plus size={14} /> Tambah ke Daftar PO
              </button>
            </form>
          </div>

          <div className="border-t border-[hsl(var(--border))] pt-4">
            <h3 className="text-xs font-bold text-[hsl(var(--muted))] uppercase mb-2">Item Terpilih</h3>
            <div className="divide-y divide-[hsl(var(--border))] max-h-40 overflow-y-auto">
              {poItems.map((it, idx) => (
                <div key={idx} className="flex justify-between py-2 text-xs">
                  <div>
                    <p className="font-semibold">{it.name}</p>
                    <p className="text-[hsl(var(--muted))]">{it.qty}{it.quantity_unit ? " " + it.quantity_unit : ""} × {fmtIDR(it.cost)}</p>
                  </div>
                  <div><p className="font-bold">{fmtIDR(it.subtotal)}</p><button disabled={busy} className="underline" onClick={()=>setPoItems(rows=>rows.filter((_,i)=>i!==idx))}>Hapus</button></div>
                </div>
              ))}
              {poItems.length === 0 && (
                <p className="text-xs text-[hsl(var(--muted))] py-4 text-center">Belum ada item ditambahkan.</p>
              )}
            </div>
            {poItems.length > 0 && (
              <div className="border-t border-[hsl(var(--border))] pt-3 mt-2 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-[hsl(var(--muted))]">Total PO Est:</span>
                  <p className="font-display font-bold text-[hsl(var(--primary))]">
                    {fmtIDR(poItems.reduce((acc, it) => acc + it.subtotal, 0))}
                  </p>
                </div>
                <button disabled={busy} onClick={handleCreatePO} className="btn-primary py-2 px-4 text-xs flex items-center gap-1">
                  <Check size={14} /> Kirim PO
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7 card-surface p-6" data-testid="po-list">
          <h2 className="font-display font-bold text-lg mb-4">Daftar Order Pembelian</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">No PO</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Supplier</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Tanggal</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Total</th>
                  <th className="py-3 text-right font-semibold text-[hsl(var(--muted))]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {orderPage.rows.map((o) => (
                  <tr key={o.id} className="hover:bg-[hsl(var(--background))]/50 transition-colors">
                    <td className="py-3 font-mono font-semibold text-xs text-[hsl(var(--primary))]">{o.po_no}</td>
                    <td className="py-3 font-medium text-xs">{o.supplier_name}</td>
                    <td className="py-3 text-xs text-[hsl(var(--muted))]">{new Date(o.created_at).toLocaleDateString("id-ID")}</td>
                    <td className="py-3 font-mono font-bold text-xs">{fmtIDR(o.total)}</td>
                    <td className="py-3 text-right">
                      <span className={`pill ${
                        o.status === "Received" ? "pill-success" :
                        o.status === "Ordered" ? "pill-warning" : "pill-danger"
                      }`}>
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-[hsl(var(--muted))]">Belum ada PO yang dibuat.</td>
                  </tr>
                )}
              </tbody>
            </table>
            <TablePage value={orderPage} label="PO"/>
          </div>
        </div>
      </div>
    </div>
  );
}
