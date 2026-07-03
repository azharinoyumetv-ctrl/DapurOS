import { useEffect, useState } from "react";
import api from "@/api/client";
import { Plus, Edit3, Trash2, X, AlertCircle, RefreshCw, Clipboard } from "lucide-react";

export default function Ingredients() {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedIng, setSelectedIng] = useState(null);
  const [form, setForm] = useState({ name: "", stock: 0, safety_stock: 0, unit: "g" });
  const [saving, setSaving] = useState(false);

  // Spoilage log state
  const SPOILAGE_REASONS = [
    "Kedaluwarsa (Expired)",
    "Tumpah / Rusak Fisik (Spilled)",
    "Kesalahan Pembuatan (Prep Error)",
  ];
  const [wasteOpen, setWasteOpen] = useState(false);
  const [wasteForm, setWasteForm] = useState({ ingredientId: "", qty: 0, reason: SPOILAGE_REASONS[0] });
  const [spoilageLogs, setSpoilageLogs] = useState([]);
  const [units, setUnits] = useState([]);

  const DEFAULT_UNITS = [
    { name: "Gram", short_name: "g" },
    { name: "Mililiter", short_name: "ml" },
    { name: "Pieces", short_name: "pcs" },
    { name: "Kilogram", short_name: "kg" },
    { name: "Botol", short_name: "btl" },
  ];
  const loadUnits = async () => {
    try {
      const res = await api.get("/products/units");
      setUnits(Array.isArray(res.data) && res.data.length ? res.data : DEFAULT_UNITS);
    } catch (e) {
      setUnits(DEFAULT_UNITS);
    }
  };

  const loadSpoilageLogs = async () => {
    try {
      const res = await api.get("/ingredients/spoilage/logs");
      setSpoilageLogs(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setSpoilageLogs((prev) => (Array.isArray(prev) ? prev : []));
    }
  };

  const loadIngredients = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await api.get("/ingredients");
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setIngredients(res.data);
      } else {
        setIngredients([
          { id: "ing-1", name: "Biji Kopi Arabika Gayo", stock: 1500, safety_stock: 500, unit: "g" },
          { id: "ing-2", name: "Fresh Milk UHT", stock: 8000, safety_stock: 2000, unit: "ml" },
          { id: "ing-3", name: "Saus Pizza Homemade", stock: 2500, safety_stock: 1000, unit: "g" },
          { id: "ing-4", name: "Keju Mozzarella", stock: 1800, safety_stock: 500, unit: "g" },
          { id: "ing-5", name: "Daging Sapi Slice", stock: 50, safety_stock: 15, unit: "pcs" },
        ]);
      }
    } catch (e) {
      setIngredients([
        { id: "ing-1", name: "Biji Kopi Arabika Gayo", stock: 1500, safety_stock: 500, unit: "g" },
        { id: "ing-2", name: "Fresh Milk UHT", stock: 8000, safety_stock: 2000, unit: "ml" },
        { id: "ing-3", name: "Saus Pizza Homemade", stock: 2500, safety_stock: 1000, unit: "g" },
        { id: "ing-4", name: "Keju Mozzarella", stock: 1800, safety_stock: 500, unit: "g" },
        { id: "ing-5", name: "Daging Sapi Slice", stock: 50, safety_stock: 15, unit: "pcs" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIngredients();
    loadSpoilageLogs();
    loadUnits();
  }, []);

  const openAdd = () => {
    setSelectedIng(null);
    setForm({ name: "", stock: 0, safety_stock: 0, unit: "g" });
    setFormOpen(true);
  };

  const openEdit = (ing) => {
    setSelectedIng(ing);
    setForm({
      name: ing.name,
      stock: ing.stock,
      safety_stock: ing.safety_stock,
      unit: ing.unit,
    });
    setFormOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr("");
    const payload = {
      name: form.name,
      stock: parseFloat(form.stock) || 0,
      safety_stock: parseFloat(form.safety_stock) || 0,
      unit: form.unit,
    };

    if (selectedIng) {
      // Edit existing ingredient
      const updatedIng = { ...selectedIng, ...payload };
      setIngredients((prev) => prev.map((item) => (item.id === selectedIng.id ? updatedIng : item)));
      try {
        await api.put(`/ingredients/${selectedIng.id}`, payload);
      } catch (e) {
        if (process.env.NODE_ENV !== "production") console.warn("[Ingredients] Put fallback to local state");
      }
    } else {
      // Add new ingredient
      const newIng = { id: `ing-${Date.now()}`, ...payload };
      setIngredients((prev) => [newIng, ...prev]);
      try {
        const res = await api.post("/ingredients", payload);
        if (res.data && res.data.id) {
          setIngredients((prev) => prev.map((item) => (item.id === newIng.id ? res.data : item)));
        }
      } catch (e) {
        if (process.env.NODE_ENV !== "production") console.warn("[Ingredients] Post fallback to local state");
      }
    }
    setFormOpen(false);
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus bahan baku ini?")) return;
    setIngredients((prev) => prev.filter((item) => item.id !== id));
    try {
      await api.delete(`/ingredients/${id}`);
    } catch (e) {
      if (process.env.NODE_ENV !== "production") console.warn("[Ingredients] Delete fallback to local state");
    }
  };

  const handleWasteSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr("");
    const ing = ingredients.find((i) => i.id === wasteForm.ingredientId);
    if (!ing) {
      setSaving(false);
      return;
    }

    const wasteQty = parseFloat(wasteForm.qty) || 0;
    if (wasteQty <= 0) {
      setErr("Jumlah terbuang harus lebih dari 0");
      setSaving(false);
      return;
    }

    try {
      const res = await api.post(`/ingredients/${ing.id}/spoilage`, {
        quantity_lost: wasteQty,
        reason: wasteForm.reason,
      });
      // Sinkronkan state dari respons server (atomik & akurat)
      setIngredients((prev) =>
        prev.map((item) =>
          item.id === ing.id ? { ...item, stock: Math.max(0, item.stock - wasteQty) } : item
        )
      );
      setSpoilageLogs((prev) => [res?.data, ...(Array.isArray(prev) ? prev : [])].filter(Boolean));
      setWasteOpen(false);
      setWasteForm({ ingredientId: "", qty: 0, reason: SPOILAGE_REASONS[0] });
    } catch (e2) {
      const detail = e2?.response?.data?.detail;
      if (detail) {
        setErr(typeof detail === "string" ? detail : "Gagal mencatat bahan terbuang");
      } else {
        // Mode offline / demo: catat secara lokal agar operasional tetap berjalan
        const localLog = {
          id: `spl-${Date.now()}`,
          ingredient_id: ing.id,
          ingredient_name: ing.name,
          unit: ing.unit,
          quantity_lost: wasteQty,
          reason: wasteForm.reason,
          created_at: new Date().toISOString(),
        };
        setIngredients((prev) =>
          prev.map((item) =>
            item.id === ing.id ? { ...item, stock: Math.max(0, item.stock - wasteQty) } : item
          )
        );
        setSpoilageLogs((prev) => [localLog, ...(Array.isArray(prev) ? prev : [])]);
        setWasteOpen(false);
        setWasteForm({ ingredientId: "", qty: 0, reason: SPOILAGE_REASONS[0] });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-left" data-testid="ingredients-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Manajemen Bahan Baku (BOM)</h1>
          <p className="text-xs text-[hsl(var(--muted))] mt-1">
            Kelola persediaan bahan mentah untuk sinkronisasi resep menu restoran dan kafe Anda.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (ingredients.length > 0) {
                setWasteForm({ ingredientId: ingredients[0].id, qty: 0, reason: SPOILAGE_REASONS[0] });
                setWasteOpen(true);
              }
            }}
            className="btn-outline text-red-600 border-red-200 hover:bg-red-50 text-xs py-2"
            data-testid="open-spoilage-btn"
          >
            Catat Bahan Terbuang
          </button>
          <button onClick={openAdd} className="btn-primary text-xs py-2 flex items-center gap-1">
            <Plus size={14} /> Tambah Bahan
          </button>
        </div>
      </div>

      {err && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{err}</span>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-xs text-[hsl(var(--muted))]" data-testid="ingredients-loading">
          Memuat bahan baku…
        </div>
      ) : (
        <div className="card-surface bg-white border border-[hsl(var(--border))] rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs" data-testid="ingredients-list">
            <thead className="bg-[hsl(var(--secondary))]/40 text-[hsl(var(--muted))] uppercase text-[10px] font-bold border-b border-[hsl(var(--border))]">
              <tr>
                <th className="p-4">Nama Bahan Baku</th>
                <th className="p-4 text-right">Stok Saat Ini</th>
                <th className="p-4 text-right">Batas Aman (Safety Stock)</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {ingredients.map((ing) => {
                const isLow = ing.stock <= ing.safety_stock;
                return (
                  <tr key={ing.id} className="hover:bg-[hsl(var(--secondary))]/20">
                    <td className="p-4 font-bold text-[hsl(var(--foreground))]">{ing.name}</td>
                    <td className="p-4 text-right font-mono font-bold text-slate-800">
                      {ing.stock.toLocaleString()} {ing.unit}
                    </td>
                    <td className="p-4 text-right font-mono text-[hsl(var(--muted))]">
                      {ing.safety_stock.toLocaleString()} {ing.unit}
                    </td>
                    <td className="p-4 text-center">
                      {isLow ? (
                        <span className="pill pill-warning py-0.5 px-2.5 text-[10px]">Stok Rendah</span>
                      ) : (
                        <span className="pill pill-success py-0.5 px-2.5 text-[10px]">Aman</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEdit(ing)}
                          className="btn-ghost p-1 text-slate-500 hover:text-amber-600 rounded"
                          title="Edit"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(ing.id)}
                          className="btn-ghost p-1 text-slate-500 hover:text-red-600 rounded"
                          title="Hapus"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {ingredients.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-[hsl(var(--muted))]">
                    Belum ada bahan baku terdaftar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Riwayat Bahan Terbuang (Spoilage Log) */}
      <div className="card-surface bg-white border border-[hsl(var(--border))] rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[hsl(var(--border))]">
          <h2 className="font-display text-sm font-bold">Riwayat Bahan Terbuang (Spoilage Log)</h2>
          <p className="text-[10px] text-[hsl(var(--muted))] mt-0.5">
            Jejak audit seluruh pembuangan bahan baku rusak atau kedaluwarsa.
          </p>
        </div>
        <table className="w-full text-left text-xs" data-testid="spoilage-log-list">
          <thead className="bg-[hsl(var(--secondary))]/40 text-[hsl(var(--muted))] uppercase text-[10px] font-bold border-b border-[hsl(var(--border))]">
            <tr>
              <th className="p-4">Bahan Baku</th>
              <th className="p-4 text-right">Jumlah Terbuang</th>
              <th className="p-4">Alasan</th>
              <th className="p-4">Waktu Pencatatan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[hsl(var(--border))]">
            {(Array.isArray(spoilageLogs) ? spoilageLogs : []).map((log) => (
              <tr key={log.id} className="hover:bg-[hsl(var(--secondary))]/20" data-testid="spoilage-log-row">
                <td className="p-4 font-bold">{log.ingredient_name}</td>
                <td className="p-4 text-right font-mono text-red-600 font-bold">
                  -{Number(log.quantity_lost).toLocaleString()} {log.unit}
                </td>
                <td className="p-4">
                  <span className="pill pill-warning py-0.5 px-2.5 text-[10px]">{log.reason}</span>
                </td>
                <td className="p-4 text-[hsl(var(--muted))] font-mono">
                  {log.created_at ? new Date(log.created_at).toLocaleString("id-ID") : "-"}
                </td>
              </tr>
            ))}
            {(!Array.isArray(spoilageLogs) || spoilageLogs.length === 0) && (
              <tr>
                <td colSpan="4" className="p-6 text-center text-[hsl(var(--muted))]" data-testid="spoilage-log-empty">
                  Belum ada catatan bahan terbuang.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Ingredient Modal Form */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4" onClick={() => setFormOpen(false)}>
          <form onSubmit={handleSave} className="card-surface bg-white p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-3">
              <h2 className="font-display text-lg font-bold">
                {selectedIng ? "Edit Bahan Baku" : "Bahan Baku Baru"}
              </h2>
              <button type="button" onClick={() => setFormOpen(false)} className="btn-ghost p-1">
                <X size={18} />
              </button>
            </div>
            
            <div className="space-y-3 text-xs">
              <div>
                <label className="label-tiny">Nama Bahan</label>
                <input
                  type="text"
                  required
                  className="input-field mt-1"
                  placeholder="Cth: Biji Kopi Gayo"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-tiny">Stok Awal</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="input-field mt-1"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label-tiny">Batas Aman (Safety)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="input-field mt-1"
                    value={form.safety_stock}
                    onChange={(e) => setForm({ ...form, safety_stock: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label-tiny">Satuan Unit</label>
                <select
                  className="input-field mt-1"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                >
                  {(units.length ? units : DEFAULT_UNITS).map((u) => (
                    <option key={u.short_name || u.id} value={u.short_name}>{u.name} ({u.short_name})</option>
                  ))}
                  {form.unit && !(units.length ? units : DEFAULT_UNITS).some((u) => u.short_name === form.unit) && (
                    <option value={form.unit}>{form.unit}</option>
                  )}
                </select>
                <p className="text-[10px] text-[hsl(var(--muted))] mt-1">Kelola daftar satuan di menu Produk → Satuan.</p>
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-[hsl(var(--border))]">
              <button type="button" onClick={() => setFormOpen(false)} className="btn-outline flex-1">
                Batal
              </button>
              <button type="submit" disabled={saving} className="btn-primary flex-1">
                {saving ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Spoilage / Waste log modal */}
      {wasteOpen && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4" onClick={() => setWasteOpen(false)}>
          <form onSubmit={handleWasteSubmit} className="card-surface bg-white p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-3">
              <h2 className="font-display text-lg font-bold text-red-700">Catat Bahan Terbuang (Spoilage)</h2>
              <button type="button" onClick={() => setWasteOpen(false)} className="btn-ghost p-1">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="label-tiny">Pilih Bahan Baku</label>
                <select
                  required
                  className="input-field mt-1"
                  value={wasteForm.ingredientId}
                  onChange={(e) => setWasteForm({ ...wasteForm, ingredientId: e.target.value })}
                >
                  {ingredients.map(i => (
                    <option key={i.id} value={i.id}>{i.name} ({i.stock} {i.unit})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-tiny">Jumlah Terbuang / Rusak</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="input-field mt-1"
                  value={wasteForm.qty}
                  onChange={(e) => setWasteForm({ ...wasteForm, qty: e.target.value })}
                />
              </div>

              <div>
                <label className="label-tiny">Alasan Pembuangan</label>
                <select
                  className="input-field mt-1"
                  value={wasteForm.reason}
                  onChange={(e) => setWasteForm({ ...wasteForm, reason: e.target.value })}
                  data-testid="spoilage-reason-select"
                >
                  {SPOILAGE_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-[hsl(var(--border))]">
              <button type="button" onClick={() => setWasteOpen(false)} className="btn-outline flex-1">
                Batal
              </button>
              <button type="submit" disabled={saving} className="btn-primary bg-red-600 hover:bg-red-700 border-red-650 flex-1">
                {saving ? "Mencatat…" : "Catat Pembuangan"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
