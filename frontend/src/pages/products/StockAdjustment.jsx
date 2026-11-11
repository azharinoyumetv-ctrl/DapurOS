import IngredientUnitSelect from "@/components/IngredientUnitSelect";
import useTablePage from '@/hooks/useTablePage';
import TablePage from '@/components/TablePage';
import { readCollection } from '@/api/records';
import { useEffect, useRef, useState } from "react";
import api from "@/api/client";
import { useAuth } from '@/auth/AuthContext';
import { loadInventoryItems, inventoryError } from '@/api/inventoryItems';
import { Plus, Check } from "lucide-react";
import { toast } from "@/components/ui/sonner";

export default function StockAdjustment() {
  const { user } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const attempt = useRef(null), lock = useRef(false);
  const [products, setProducts] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const historyPage=useTablePage(adjustments);
  
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [quantityUnit, setQuantityUnit] = useState("");
  const selectedIngredient = products.find(item => item.key === productId && item.kind === "ingredient");
  const [type, setType] = useState("add"); // add | subtract
  const [reason, setReason] = useState("");

  const fetchData = () => {
    loadInventoryItems(user?.plan).then(setProducts).catch(e => setError(inventoryError(e)));
    readCollection("/products/stock-adjustments").then((r) => setAdjustments(r.data)).catch(e => setError(inventoryError(e)));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lock.current || !productId || !Number.isFinite(Number(qty)) || Number(qty) <= 0) return;

    const prod = products.find(p => p.key === productId);
    if (!prod) return;

    const payload = {
      product_id: prod.id, kind: prod.kind,
      product_name: prod.name,
      sku: prod.sku,
      adjustment_qty: Number(qty),
      quantity_unit: quantityUnit || undefined,
      type,
      reason,
    };
    const fingerprint = JSON.stringify(payload);
    if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, id: crypto.randomUUID() };
    lock.current = true; setBusy(true); setError('');
    try {
      await api.post("/products/stock-adjustments", { ...payload, request_id: attempt.current.id });
      attempt.current = null;
      setProductId("");
      setQty("");
      setReason("");
      fetchData();
      toast.success("Penyesuaian stok berhasil disimpan!");
    } catch(e) { setError(inventoryError(e)); }
    finally { lock.current = false; setBusy(false); }
  };

  return (
    <div className="p-8 space-y-6" data-testid="stock-adjustment-page">
      <div>
        <span className="label-tiny">Produk</span>
        <h1 className="font-display text-3xl font-bold mt-1">Stock Adjustment</h1>
      </div>

      {error && <p role="alert" className="text-red-700">{error}</p>}
      <div className="grid grid-cols-12 gap-6">
        <form onSubmit={handleSubmit} className="col-span-12 lg:col-span-4 card-surface p-6 space-y-4" data-testid="adjustment-form">
          <h2 className="font-display font-bold text-lg">Input Penyesuaian</h2>
          
          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Pilih Produk</label>
            <select
              value={productId}
              onChange={event => { setProductId(event.target.value); setQuantityUnit(""); setQty(""); }}
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
              data-testid="adjustment-product-select"
            >
              <option value="">-- Pilih Produk --</option>
              {products.map(p => (
                <option key={p.key} value={p.key}>{p.name} ({p.kind === 'ingredient' ? 'Bahan baku' : 'Produk'} | Stok: {p.stock} {p.unit})</option>
              ))}
            </select>
          </div>

          <IngredientUnitSelect base={selectedIngredient?.unit} value={quantityUnit} onChange={setQuantityUnit} />
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Tipe</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
              >
                <option value="add">Tambah (+) </option>
                <option value="sub">Kurangi (-) </option>
              </select>
            </div>
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Jumlah</label>
              <input
                type="number"
                min={productId.startsWith('ingredient:') ? '0.000001' : '1'} step={productId.startsWith('ingredient:') ? 'any' : '1'} required
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="Jumlah qty"
                className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-xs font-semibold text-[hsl(var(--muted))] uppercase">Alasan Penyesuaian</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Barang rusak, selisih opname"
              className="border border-[hsl(var(--border))] rounded-md px-4 py-2 bg-white text-[hsl(var(--foreground))] outline-none h-20 resize-none text-sm"
            />
          </div>

          <button type="submit" disabled={busy} className="btn-primary w-full py-2 flex items-center justify-center gap-2" data-testid="adjustment-submit">
            <Check size={16} /> Simpan Penyesuaian
          </button>
        </form>

        <div className="col-span-12 lg:col-span-8 card-surface p-6" data-testid="adjustment-list">
          <h2 className="font-display font-bold text-lg mb-4">Riwayat Penyesuaian Stok</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--border))]">
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Tanggal</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Produk</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">SKU</th>
                  <th className="py-3 text-center font-semibold text-[hsl(var(--muted))]">Qty</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Alasan</th>
                  <th className="py-3 font-semibold text-[hsl(var(--muted))]">Oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {historyPage.rows.map((a) => (
                  <tr key={a.id} className="hover:bg-[hsl(var(--background))]/50 transition-colors">
                    <td className="py-3 text-[hsl(var(--muted))]">{new Date(a.created_at).toLocaleDateString("id-ID")}</td>
                    <td className="py-3 font-medium">{a.product_name}</td>
                    <td className="py-3 font-mono">{a.sku}</td>
                    <td className={`py-3 text-center font-bold ${a.type === "add" ? "text-emerald-600" : "text-red-500"}`}>
                      {a.type === "add" ? "+" : "-"}{a.adjustment_qty} {a.quantity_unit}
                    </td>
                    <td className="py-3">{a.reason || "-"}</td>
                    <td className="py-3 text-xs text-[hsl(var(--muted))]">{a.created_by}</td>
                  </tr>
                ))}
                {adjustments.length === 0 && (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-[hsl(var(--muted))]">Belum ada riwayat penyesuaian stok.</td>
                  </tr>
                )}
              </tbody>
            </table>
            <TablePage value={historyPage} label="penyesuaian"/>
          </div>
        </div>
      </div>
    </div>
  );
}
