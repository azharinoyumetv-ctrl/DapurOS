import IngredientUnitSelect from "@/components/IngredientUnitSelect";
import useTablePage from '@/hooks/useTablePage';
import TablePage from '@/components/TablePage';
import { readCollection } from '@/api/records';
import { useEffect, useRef, useState } from "react";
import api from "@/api/client";
import { loadInventoryItems, inventoryError } from '@/api/inventoryItems';
import { Plus, Send, Check } from "lucide-react";
import { toast } from "@/components/ui/sonner";

export default function StockTransfer() {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const lock = useRef(false), attempt = useRef(null);
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const historyPage=useTablePage(transfers);

  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [quantityUnit, setQuantityUnit] = useState("");
  const selectedIngredient = products.find(item => item.key === productId && item.kind === "ingredient");
  const [fromBranch, setFromBranch] = useState("main");
  const [toBranch, setToBranch] = useState("");

  const fetchData = () => {
    loadInventoryItems('business').then(setProducts).catch(e => setError(inventoryError(e)));
    api.get("/products/transfer-branches").then((r) => setBranches(r.data)).catch(e => setError(inventoryError(e)));
    readCollection("/products/stock-transfers").then((r) => setTransfers(r.data)).catch(e => setError(inventoryError(e)));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lock.current || !productId || !Number.isFinite(Number(qty)) || Number(qty)<=0 || !toBranch || fromBranch === toBranch) return;

    const prod = products.find(p => p.key === productId);
    if (!prod) return;

    const payload = {
      from_branch: fromBranch,
      to_branch: toBranch,
      items: [{ product_id: prod.id, kind: prod.kind, name: prod.name, qty: Number(qty), quantity_unit: quantityUnit || undefined }],
      status: "Shipped",
    };
    const fingerprint = JSON.stringify(payload);
    if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, id: crypto.randomUUID() };
    lock.current = true; setBusy(true); setError('');
    try {
      await api.post("/products/stock-transfers", { ...payload, request_id: attempt.current.id });
      attempt.current = null;
      setProductId("");
      setQty("");
      setToBranch("");
      fetchData();
      toast.success("Transfer stok berhasil dikirim!");
    } catch(e) { setError(inventoryError(e)); }
    finally { lock.current = false; setBusy(false); }
  };
  const finish = async (transfer, action) => {
    if (lock.current || !window.confirm(action === 'receive' ? 'Konfirmasi barang sudah sampai di cabang tujuan?' : 'Batalkan pengiriman dan kembalikan stok ke cabang asal?')) return;
    lock.current = true; setBusy(true); setError('');
    try { await api.post(`/products/stock-transfers/${transfer.id}/${action}`); fetchData(); }
    catch(e) { setError(inventoryError(e)); }
    finally { lock.current = false; setBusy(false); }
  };

  return (
    <div className="p-8 space-y-6" data-testid="stock-transfer-page">
      <div>
        <span className="label-tiny">Produk</span>
        <h1 className="font-display text-3xl font-bold mt-1">Stock Transfer</h1>
      </div>

      {error && <p role="alert" className="text-red-700">{error}</p>}
      <div className="grid grid-cols-12 gap-6">
        <form onSubmit={handleSubmit} className="col-span-12 lg:col-span-4 card-surface p-6 space-y-4" data-testid="transfer-form">
          <h2 className="font-display font-bold text-lg">Kirim Stok Cabang</h2>
          
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Dari Cabang</label>
            <select
              onChange={e => setFromBranch(e.target.value)}
              value={fromBranch}
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-[hsl(var(--background))] text-[hsl(var(--muted))] outline-none text-sm cursor-not-allowed"
            ><option value="main">Restoran utama</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Ke Cabang Tujuan</label>
            <select
              value={toBranch}
              onChange={(e) => setToBranch(e.target.value)}
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
              data-testid="transfer-dest-select"
            >
              <option value="">-- Pilih Cabang --</option>
              {fromBranch !== 'main' && <option value="main">Restoran utama</option>}
              {branches.map(b => (
                <option key={b.id} value={b.id} disabled={b.id === fromBranch}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Pilih Produk</label>
            <select
              value={productId}
              onChange={event => { setProductId(event.target.value); setQuantityUnit(""); setQty(""); }}
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
            >
              <option value="">-- Pilih Produk --</option>
              {products.map(p => (
                <option key={p.key} value={p.key}>{p.name} (Stok: {fromBranch === 'main' ? p.stock : p.stock_by_branch?.[fromBranch] || 0} {p.unit})</option>
              ))}
            </select>
          </div>

          <IngredientUnitSelect base={selectedIngredient?.unit} value={quantityUnit} onChange={setQuantityUnit} />
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Jumlah Transfer</label>
            <input
              type="number"
              required min={productId.startsWith('ingredient:') ? '0.000001' : '1'} step={productId.startsWith('ingredient:') ? 'any' : '1'}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Jumlah qty"
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
            />
          </div>

          <button type="submit" disabled={busy} className="btn-primary w-full py-2 flex items-center justify-center gap-2">
            <Send size={16} /> Kirim Barang
          </button>
        </form>

        <div className="col-span-12 lg:col-span-8 card-surface p-6" data-testid="transfer-list">
          <h2 className="font-display font-bold text-lg mb-4">Mutasi Transfer Antar Cabang</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Tanggal</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Dari</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Ke Cabang</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Items</th>
                  <th className="py-3 text-right font-semibold text-[hsl(var(--muted))]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {historyPage.rows.map((t) => (
                  <tr key={t.id} className="hover:bg-[hsl(var(--background))]/50 transition-colors">
                    <td className="py-3 text-[hsl(var(--muted))]">{new Date(t.created_at).toLocaleDateString("id-ID")}</td>
                    <td className="py-3 font-medium text-xs">{t.from_branch}</td>
                    <td className="py-3 font-medium text-xs">{t.to_branch}</td>
                    <td className="py-3">
                      {t.items?.map((it, idx) => (
                        <div key={idx} className="text-xs">
                          {it.name} <span className="font-semibold text-[hsl(var(--primary))]">({it.qty} {it.quantity_unit || "Qty"})</span>
                        </div>
                      ))}
                    </td>
                    <td className="py-3 text-right">
                      <span className={`pill ${t.status === "Received" ? "pill-success" : "pill-warning"}`}>
                        {t.status}
                      </span>
                      {t.status === 'Shipped' && t.inventory_applied && <div className="flex gap-2 mt-2 justify-end"><button disabled={busy} className="btn-primary text-xs" onClick={() => finish(t, 'receive')}>Terima</button><button disabled={busy} className="btn-outline text-xs" onClick={() => finish(t, 'cancel')}>Batalkan</button></div>}
                    </td>
                  </tr>
                ))}
                {transfers.length === 0 && (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-[hsl(var(--muted))]">Belum ada mutasi transfer antar cabang.</td>
                  </tr>
                )}
              </tbody>
            </table>
            <TablePage value={historyPage} label="transfer"/>
          </div>
        </div>
      </div>
    </div>
  );
}
