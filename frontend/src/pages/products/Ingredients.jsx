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
  const [wasteOpen, setWasteOpen] = useState(false);
  const [wasteForm, setWasteForm] = useState({ ingredientId: "", qty: 0, reason: "Expired" });

  const loadIngredients = async () => {
    setLoading(true);
    try {
      const res = await api.get("/ingredients");
      setIngredients(res.data);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Gagal memuat daftar bahan baku");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIngredients();
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
    try {
      const payload = {
        name: form.name,
        stock: parseFloat(form.stock),
        safety_stock: parseFloat(form.safety_stock),
        unit: form.unit,
      };
      if (selectedIng) {
        await api.put(`/ingredients/${selectedIng.id}`, payload);
      } else {
        await api.post("/ingredients", payload);
      }
      setFormOpen(false);
      loadIngredients();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Hapus bahan baku ini? Menghapus bahan baku akan melepaskannya dari resep produk.")) return;
    try {
      await api.delete(`/ingredients/${id}`);
      loadIngredients();
    } catch (e) {
      alert(e?.response?.data?.detail || "Gagal menghapus");
    }
  };

  const handleWasteSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const ing = ingredients.find(i => i.id === wasteForm.ingredientId);
      if (!ing) return;
      
      // Update stock level
      const updatedStock = Math.max(0, ing.stock - parseFloat(wasteForm.qty));
      await api.put(`/ingredients/${ing.id}`, { stock: updatedStock });
      
      setWasteOpen(false);
      setWasteForm({ ingredientId: "", qty: 0, reason: "Expired" });
      loadIngredients();
    } catch (e) {
      alert("Gagal mencatat pembuangan bahan");
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
                setWasteForm({ ingredientId: ingredients[0].id, qty: 0, reason: "Expired" });
                setWasteOpen(true);
              }
            }}
            className="btn-outline text-red-600 border-red-200 hover:bg-red-50 text-xs py-2"
          >
            Log Spoilage / Waste
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
                  <option value="g">Gram (g)</option>
                  <option value="ml">Mililiter (ml)</option>
                  <option value="pcs">Pieces (pcs)</option>
                  <option value="kg">Kilogram (kg)</option>
                  <option value="btl">Botol (btl)</option>
                </select>
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
              <h2 className="font-display text-lg font-bold text-red-700">Catat Spoilage / Waste</h2>
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
                >
                  <option value="Expired">Kedaluwarsa (Expired)</option>
                  <option value="Spilled">Tumpah / Rusak Fisik</option>
                  <option value="Prep Error">Kesalahan Pembuatan</option>
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
