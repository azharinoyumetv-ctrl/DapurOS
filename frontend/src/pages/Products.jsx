import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import api, { fmtIDR, API_BASE, downloadBlob } from "@/api/client";
import { Plus, Upload, Search, Edit3, Trash2, X, Download, FileSpreadsheet, CheckCircle2, AlertCircle, ScanBarcode, Camera, Images } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useAuth } from '@/auth/AuthContext';
import { isPlanLocked } from '@/navigation/sections';
import { loadCatalogue } from '@/api/catalogue';
import { readCollection } from '@/api/records';
import { canManageProducts } from '@/auth/permissions';
import useTablePage from '@/hooks/useTablePage';
import TablePage from '@/components/TablePage';
import ReadState from '@/components/ReadState';
import TicketStationSelect from '@/components/TicketStationSelect';

function ProductForm({ product, categories, categoriesLoading, categoriesError, onRetryCategories, productUnits, unitsLoading, unitsError, onRetryUnits, onClose, onSaved }) {
  const { user } = useAuth();
  const isDapurOS = !isPlanLocked('pro', user?.plan);
  const isEdit = !!product?.id;
  const [form, setForm] = useState({
    name: product?.name || "",
    sku: product?.sku || "",
    price: product?.price || 0,
    cost: product?.cost || 0,
    stock: product?.stock || 0,
    category: product?.category || "Umum",
    ticket_station: product?.ticket_station || "Auto",
    unit: product?.unit || "pcs",
    description: product?.description || "",
    active: product?.active !== false,
    image_url: product?.image_url || null,
    recipe: product?.recipe || [],
  });
  useEffect(() => { const scan = event => { if (event.detail?.target === 'product' && typeof event.detail.value === 'string' && event.detail.value.length <= 200) setForm(f => ({...f, sku: event.detail.value})); }; window.addEventListener('dapuros-barcode', scan); return () => window.removeEventListener('dapuros-barcode', scan); }, []);
  const saveLock = useRef(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const photoRequest = useRef(0);
  const galleryInput = useRef(null);
  const cameraInput = useRef(null);
  const canTakePhoto = window.__dapurosAndroid || /Android|iPhone|iPad/i.test(navigator.userAgent);
  const [customCategory, setCustomCategory] = useState(false);
  const categoryOptions = [...new Set(["Umum", ...categories, ...(!customCategory && form.category ? [form.category] : [])])];
  const [customUnit, setCustomUnit] = useState(false);
  // Products store the symbol, not the registry id. Preserve older free-text
  // values verbatim until the owner explicitly chooses a replacement.
  const unitOptions = new Map(productUnits.map(unit => [unit.value, unit.label]));
  if (!unitOptions.has("pcs")) unitOptions.set("pcs", "pcs");
  if (!customUnit && form.unit && !unitOptions.has(form.unit)) unitOptions.set(form.unit, form.unit);
  useEffect(() => () => { photoRequest.current++; }, []);
  
  const [ingredients, setIngredients] = useState([]);
  const [selectedIngredientId, setSelectedIngredientId] = useState("");
  const [ingredientQty, setIngredientQty] = useState("");
  const [units, setUnits] = useState([]);
  const [newIngOpen, setNewIngOpen] = useState(false);
  const [newIng, setNewIng] = useState({ name: "", unit: "g" });
  const [creatingIng, setCreatingIng] = useState(false);

  const loadIngredients = async (selectId) => {
    try {
      const res = await readCollection("/ingredients");
      setIngredients(res.data);
      if (selectId) setSelectedIngredientId(selectId);
      else if (res.data.length > 0) setSelectedIngredientId((cur) => cur || res.data[0].id);
    } catch (err) {
      console.error("Gagal memuat bahan baku", err);
    }
  };

  useEffect(() => {
    if (!isDapurOS) return;
    loadIngredients();
    readCollection("/products/units").then((r) => setUnits(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDapurOS]);

  const createIngredient = async () => {
    if (!newIng.name.trim()) return;
    setCreatingIng(true);
    try {
      const res = await api.post("/ingredients", { name: newIng.name.trim(), stock: 0, safety_stock: 0, unit: newIng.unit });
      await loadIngredients(res.data?.id);
      setNewIng({ name: "", unit: "g" });
      setNewIngOpen(false);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Gagal menambah bahan baku");
    } finally {
      setCreatingIng(false);
    }
  };

  const addIngredientToRecipe = () => {
    const qty = parseFloat(ingredientQty);
    if (!selectedIngredientId || isNaN(qty) || qty <= 0) return;
    const ing = ingredients.find(i => i.id === selectedIngredientId);
    if (!ing) return;

    const exists = form.recipe.find(r => r.ingredient_id === selectedIngredientId);
    if (exists) {
      setForm({
        ...form,
        recipe: form.recipe.map(r =>
          r.ingredient_id === selectedIngredientId
            ? { ...r, quantity: r.quantity + qty }
            : r
        )
      });
    } else {
      setForm({
        ...form,
        recipe: [...form.recipe, { ingredient_id: selectedIngredientId, quantity: qty }]
      });
    }
    setIngredientQty("");
  };

  const removeIngredientFromRecipe = (id) => {
    setForm({
      ...form,
      recipe: form.recipe.filter(r => r.ingredient_id !== id)
    });
  };

  const getIngredientDetails = (id) => {
    const ing = ingredients.find(i => i.id === id);
    return ing ? { name: ing.name, unit: ing.unit } : { name: "Bahan (" + id.substring(0, 6) + ")", unit: "" };
  };

  const handleImage = (file) => {
    if (!file) return;
    const request = ++photoRequest.current;
    const release = () => { try { window.DapurOSDevice?.releaseProductPhoto?.(file.name); } catch {} };
    const failed = () => {
      if (request !== photoRequest.current) return;
      setPhotoProcessing(false); setErr("Foto tidak dapat dibaca. Pilih gambar lain atau ambil foto kembali.");
    };
    setErr("");
    if (!file.type.startsWith("image/")) { release(); setPhotoProcessing(false); setErr("File harus berupa gambar (JPG/PNG/WebP)."); return; }
    setPhotoProcessing(true);
    const reader = new FileReader();
    reader.onloadend = release;
    reader.onerror = failed;
    reader.onabort = failed;
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = failed;
      img.onload = () => {
        if (request !== photoRequest.current) return;
        try {
          const MAX = 320;
          let { width, height } = img;
          if (width > height && width > MAX) { height = Math.round((height * MAX) / width); width = MAX; }
          else if (height > MAX) { width = Math.round((width * MAX) / height); height = MAX; }
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          setForm((f) => ({ ...f, image_url: canvas.toDataURL("image/jpeg", 0.72) }));
          setPhotoProcessing(false);
        } catch { failed(); }
      };
      img.src = ev.target.result;
    };
    try { reader.readAsDataURL(file); } catch { release(); failed(); }
  };

  const chooseImage = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    handleImage(file);
  };

  const save = async (e) => {
    e.preventDefault();
    if (saveLock.current || photoProcessing) return;
    if (!form.category.trim()) { setErr("Pilih atau isi kategori produk."); return; }
    if (!form.unit.trim()) { setErr("Pilih atau isi satuan produk."); return; }
    saveLock.current = true;
    setSaving(true); setErr("");
    try {
      const payload = {
        ...form,
        category: customCategory ? form.category.trim() : form.category,
        unit: customUnit ? form.unit.trim() : form.unit,
        price: parseFloat(form.price),
        cost: parseFloat(form.cost),
        stock: parseInt(form.stock, 10) || 0,
        recipe: isDapurOS ? form.recipe.map(r => ({
          ingredient_id: r.ingredient_id,
          quantity: parseFloat(r.quantity)
        })) : null
      };
      if (isEdit) await api.put(`/products/${product.id}`, { ...payload, expected_stock: product.stock });
      else await api.post("/products", payload);
      onSaved();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      setErr(typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map(v => v.msg || "Data tidak valid").join("; ") : "Gagal menyimpan. Periksa koneksi lalu coba lagi.");
    } finally { setSaving(false); saveLock.current = false; }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4" onClick={onClose} data-testid="product-form-modal">
      <form onSubmit={save} className={`card-surface bg-white p-6 w-full ${isDapurOS ? "max-w-4xl" : "max-w-xl"} max-h-[calc(100dvh-2rem)]`} style={{overflowY:"auto"}} onClick={(e) => e.stopPropagation()} data-testid="product-form">
        <div className="flex items-center justify-between mb-5 border-b pb-3">
          <h2 className="font-display text-xl font-bold">{isEdit ? "Edit Produk" : "Produk Baru"}</h2>
          <button type="button" onClick={onClose} className="btn-ghost p-2" data-testid="product-form-close"><X size={18} /></button>
        </div>

        <div className={`grid ${isDapurOS ? "md:grid-cols-2 gap-8" : "grid-cols-1"} text-left`}>
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase text-amber-800 tracking-wider">Detail Informasi Produk</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label-tiny">Nama Produk</label>
                <input className="input-field mt-1.5" required value={form.name}
                       onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="pf-name" />
              </div>
              <div>
                <label className="label-tiny">SKU</label>
                <input className="input-field mt-1.5" value={form.sku}
                       onChange={(e) => setForm({ ...form, sku: e.target.value })} data-testid="pf-sku" />
                {window.DapurOSDevice?.scanBarcode && <button type="button" className="btn-outline mt-2" onClick={() => window.DapurOSDevice.scanBarcode("product")} data-testid="pf-scan-barcode"><ScanBarcode size={16}/> Scan barcode</button>}
              </div>
              <div>
            <label className="label-tiny" htmlFor="product-category">Kategori</label>
            <select id="product-category" className="input-field mt-1.5" data-testid="pf-category"
                    value={customCategory ? "custom" : `category:${form.category}`} aria-busy={categoriesLoading}
                    onChange={(e) => {
                      const custom = e.target.value === "custom";
                      setCustomCategory(custom);
                      setForm({ ...form, category: custom ? "" : e.target.value.slice("category:".length) });
                    }}>
              {categoryOptions.map(name => <option key={name} value={`category:${name}`}>{name}</option>)}
              <option value="custom">Kategori lainnya…</option>
            </select>
            {customCategory && <input className="input-field mt-2" required autoFocus aria-label="Nama kategori baru"
              placeholder="Nama kategori" value={form.category} data-testid="pf-category-custom"
              onChange={(e) => setForm({ ...form, category: e.target.value })} />}
            {categoriesLoading && <p role="status" className="text-xs mt-1">Memuat kategori…</p>}
            {categoriesError && <div role="alert" className="text-xs mt-1" data-testid="pf-category-error">
              <p>{categoriesError}</p><button type="button" className="underline mt-1" onClick={onRetryCategories}>Coba lagi</button>
            </div>}              </div>
              <div>
                <label className="label-tiny">Harga Jual (Rp)</label>
                <input className="input-field mt-1.5" type="number" step="0.01" required value={form.price}
                       onChange={(e) => setForm({ ...form, price: e.target.value })} data-testid="pf-price" />
              </div>
              <div>
                <label className="label-tiny">HPP (Rp)</label>
                <input className="input-field mt-1.5" type="number" step="0.01" value={form.cost}
                       onChange={(e) => setForm({ ...form, cost: e.target.value })} data-testid="pf-cost" />
              </div>
              <div>
                <label className="label-tiny">Stok (Diabaikan jika pakai BOM)</label>
                <input className="input-field mt-1.5" type="number" value={form.stock}
                       onChange={(e) => setForm({ ...form, stock: e.target.value })} data-testid="pf-stock" />
              </div>
              <div>
            <label className="label-tiny" htmlFor="product-unit">Unit</label>
            <select id="product-unit" className="input-field mt-1.5" data-testid="pf-unit"
                    value={customUnit ? "custom" : `unit:${form.unit}`} aria-busy={unitsLoading}
                    onChange={(e) => {
                      const custom = e.target.value === "custom";
                      setCustomUnit(custom);
                      setForm({ ...form, unit: custom ? "" : e.target.value.slice("unit:".length) });
                    }}>
              {[...unitOptions].map(([value, label]) => <option key={value} value={`unit:${value}`}>{label}</option>)}
              <option value="custom">Satuan lainnya…</option>
            </select>
            {customUnit && <input className="input-field mt-2" required autoFocus aria-label="Satuan lainnya"
              placeholder="Simbol satuan" value={form.unit} data-testid="pf-unit-custom"
              onChange={(e) => setForm({ ...form, unit: e.target.value })} />}
            {unitsLoading && <p role="status" className="text-xs mt-1">Memuat satuan…</p>}
            {unitsError && <div role="alert" className="text-xs mt-1" data-testid="pf-unit-error">
              <p>{unitsError}</p><button type="button" className="underline mt-1" onClick={onRetryUnits}>Coba lagi</button>
            </div>}              </div>
            </div>
            <TicketStationSelect value={form.ticket_station} onChange={ticket_station => setForm(current => ({ ...current, ticket_station }))} />
            <div>
              <label className="label-tiny block mb-1.5">Foto Produk</label>
            {form.image_url ? (
              <div className="relative w-full">
                <img src={form.image_url} alt="Pratinjau produk" className="w-full h-40 object-cover rounded-lg border border-slate-200" data-testid="pf-image-preview" />
                <button type="button" disabled={saving || photoProcessing} onClick={() => setForm({ ...form, image_url: null })} title="Hapus foto"
                  className="absolute top-2 right-2 bg-white/90 hover:bg-white text-red-600 rounded-lg p-1.5 shadow" data-testid="pf-image-remove"><Trash2 size={16} /></button>
              </div>
            ) : (
              <label htmlFor="pf-image-input" className="flex flex-col items-center justify-center gap-1 w-full h-40 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-amber-400 hover:bg-amber-50/30 transition-colors text-center" data-testid="pf-image-drop">
                <Upload size={22} className="text-slate-400" />
                <span className="text-xs font-semibold text-slate-500">Tambahkan foto produk</span>
                <span className="text-[10px] text-slate-400">JPG/PNG · otomatis dikecilkan</span>
              </label>
            )}
            <div className="flex gap-2 mt-2">
              {canTakePhoto && <button type="button" disabled={saving || photoProcessing} className="btn-outline flex-1" onClick={() => cameraInput.current?.click()} data-testid="pf-photo-camera"><Camera size={16} /> Ambil foto</button>}
              <button type="button" disabled={saving || photoProcessing} className="btn-outline flex-1" onClick={() => galleryInput.current?.click()} data-testid="pf-photo-gallery"><Images size={16} /> {canTakePhoto ? "Pilih dari galeri" : "Pilih gambar"}</button>
            </div>
            {photoProcessing && <p role="status" className="text-xs mt-2" data-testid="pf-photo-processing">Memproses foto…</p>}
            <input ref={galleryInput} id="pf-image-input" type="file" accept="image/*" disabled={saving || photoProcessing} className="hidden" onChange={chooseImage} data-testid="pf-image-input" />
            <input ref={cameraInput} id="pf-camera-input" type="file" accept="image/*" capture="environment" disabled={saving || photoProcessing} className="hidden" onChange={chooseImage} data-testid="pf-camera-input" />
            </div>
          </div>

          {isDapurOS && (
            <div className="space-y-4 border-l pl-8 border-slate-100">
              <div>
                <h3 className="text-xs font-black uppercase text-amber-850 tracking-wider">Resep / BOM (Bahan Baku)</h3>
                <p className="text-[10px] text-[hsl(var(--muted))] mt-1">
                  Gunakan resep jika produk ini diproduksi dari bahan mentah. Penjualan otomatis memotong stok bahan baku.
                </p>
              </div>

              <div>
                <button type="button" onClick={() => setNewIngOpen((o) => !o)} className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1" data-testid="bom-add-ingredient-toggle">
                  <Plus size={13} /> {newIngOpen ? "Tutup form bahan" : "Tambah bahan baku baru"}
                </button>
                {newIngOpen && (
                  <div className="mt-2 flex gap-2 items-end bg-white p-2.5 rounded-lg border border-amber-100">
                    <div className="flex-1 text-xs">
                      <label className="label-tiny block mb-1">Nama bahan</label>
                      <input className="input-field py-1.5 text-xs" placeholder="Cth: Gula Aren" value={newIng.name} onChange={(e) => setNewIng({ ...newIng, name: e.target.value })} data-testid="bom-new-ing-name" />
                    </div>
                    <div className="w-24 text-xs">
                      <label className="label-tiny block mb-1">Satuan</label>
                      <select className="input-field py-1.5 text-xs" value={newIng.unit} onChange={(e) => setNewIng({ ...newIng, unit: e.target.value })}>
                        {(units.length ? units : [{ name: "Gram", short_name: "g" }, { name: "Mililiter", short_name: "ml" }, { name: "Pieces", short_name: "pcs" }, { name: "Kilogram", short_name: "kg" }, { name: "Botol", short_name: "btl" }]).map((u) => (
                          <option key={u.short_name || u.id} value={u.short_name}>{u.short_name}</option>
                        ))}
                      </select>
                    </div>
                    <button type="button" onClick={createIngredient} disabled={creatingIng || !newIng.name.trim()} className="btn-primary py-1.5 px-3 text-xs bg-amber-600 hover:bg-amber-700 border-amber-600 font-bold shrink-0 text-white rounded" data-testid="bom-new-ing-save">
                      {creatingIng ? "…" : "Simpan"}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-2 items-end bg-amber-50/40 p-3 rounded-lg border border-amber-100/50">
                <div className="flex-1 text-xs">
                  <label className="label-tiny block mb-1">Pilih Bahan Mentah</label>
                  <select
                    value={selectedIngredientId}
                    onChange={(e) => setSelectedIngredientId(e.target.value)}
                    className="input-field py-2 text-xs bg-white"
                  >
                    {ingredients.map(i => (
                      <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                    ))}
                    {ingredients.length === 0 && <option value="">— Belum ada bahan baku —</option>}
                  </select>
                </div>
                <div className="w-24 text-xs">
                  <label className="label-tiny block mb-1">Jumlah</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="input-field py-2 text-xs bg-white"
                    value={ingredientQty}
                    onChange={(e) => setIngredientQty(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={addIngredientToRecipe}
                  className="btn-primary py-2 px-3 text-xs bg-amber-600 hover:bg-amber-700 border-amber-600 font-bold shrink-0 text-white rounded"
                >
                  Tambah
                </button>
              </div>

              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                <span className="text-[10px] uppercase font-bold text-slate-450 block">Daftar Bahan Digunakan:</span>
                {form.recipe.length > 0 ? (
                  form.recipe.map((r, idx) => {
                    const details = getIngredientDetails(r.ingredient_id);
                    return (
                      <div key={idx} className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded border border-slate-100">
                        <div>
                          <span className="font-bold text-slate-700">{details.name}</span>
                          <span className="text-[10px] text-slate-400 ml-1">({r.ingredient_id.substring(0,6)})</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-slate-800">
                            {r.quantity} {details.unit}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeIngredientFromRecipe(r.ingredient_id)}
                            className="text-red-500 hover:text-red-700 p-1 font-black"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-[11px] text-[hsl(var(--muted))] border border-dashed rounded-lg p-6 text-center">
                    Belum ada bahan baku dikonfigurasi. Produk ini akan dipotong langsung sebagai unit retail utuh.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {err && <p role="alert" data-testid="pf-error" className="text-sm text-[hsl(var(--destructive))] mt-3">{err}</p>}
        <div className="flex gap-2 mt-6 border-t pt-4">
          <button type="button" onClick={onClose} className="btn-outline flex-1" data-testid="pf-cancel">Batal</button>
          <button type="submit" disabled={saving || photoProcessing} className="btn-primary bg-amber-600 hover:bg-amber-700 border-amber-650 flex-1 text-white" data-testid="pf-save">
            {saving ? "Menyimpan…" : "Simpan Produk"}
          </button>
        </div>
      </form>
    </div>, document.body
  );
}

function ImportDialog({ onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const dropRef = useRef(null);

  const onDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true); setErr(""); setResult(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await api.post("/products/bulk-import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(r.data);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Gagal upload");
    } finally { setUploading(false); }
  };

  const finish = () => { onDone(); onClose(); };

  return (
    <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4" data-testid="import-dialog">
      <div className="card-surface bg-white p-6 w-full max-w-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl font-bold">Import Produk dari Excel / CSV</h2>
          <button onClick={onClose} className="btn-ghost p-2" data-testid="import-close"><X size={18} /></button>
        </div>

        {!result && (
          <>
            <div
              ref={dropRef}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className="border-2 border-dashed rounded-lg p-10 text-center bg-[hsl(var(--background))] hover:border-[hsl(var(--primary))] transition-colors"
              style={{ borderColor: "hsl(var(--border))" }}
              data-testid="import-dropzone"
            >
              <FileSpreadsheet size={42} className="mx-auto text-[hsl(var(--primary))] mb-3" />
              <p className="font-display font-bold text-lg">Drag & Drop file di sini</p>
              <p className="text-sm text-[hsl(var(--muted))] mt-1">atau klik untuk pilih file (.xlsx, .csv)</p>
              <input
                id="import-file"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0])}
                data-testid="import-file-input"
              />
              <label htmlFor="import-file" className="btn-outline mt-4 inline-flex cursor-pointer" data-testid="import-browse-btn">
                Pilih File
              </label>
              {file && (
                <p className="text-sm font-medium mt-4" data-testid="import-selected-file">
                  📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            <div className="flex items-center justify-between mt-4">
              <a
                href={`${API_BASE}/products/import-template.csv`}
                onClick={e=>{e.preventDefault();api.get('/products/import-template.csv',{responseType:'blob'}).then(r=>downloadBlob(r.data,'dapuros-menu-template.csv')).catch(()=>setErr('Template belum dapat diunduh. Coba lagi.'));}}
                className="text-sm text-[hsl(var(--primary))] flex items-center gap-1.5 font-semibold"
                data-testid="import-template-link"
              >
                <Download size={14} /> Download template CSV
              </a>
              <p className="text-xs text-[hsl(var(--muted))]">Kolom wajib: <code>name</code>, <code>price</code></p>
            </div>

            {err && <p className="text-sm text-[hsl(var(--destructive))] mt-3" data-testid="import-error">{err}</p>}

            <div className="flex gap-2 mt-5">
              <button onClick={onClose} className="btn-outline flex-1" data-testid="import-cancel">Batal</button>
              <button onClick={upload} disabled={!file || uploading} className="btn-primary flex-1" data-testid="import-upload-btn">
                <Upload size={16} /> {uploading ? "Mengimpor…" : "Mulai Impor"}
              </button>
            </div>
          </>
        )}

        {result && (
          <div data-testid="import-result">
            <div className="grid grid-cols-4 gap-3">
              <div className="card-surface p-4 text-center">
                <p className="label-tiny">Ditambahkan</p>
                <p className="font-display num-display text-3xl font-extrabold text-[hsl(var(--success))]" data-testid="import-inserted">
                  {result.inserted}
                </p>
              </div>
              <div className="card-surface p-4 text-center">
                <p className="label-tiny">Diupdate</p>
                <p className="font-display num-display text-3xl font-extrabold" data-testid="import-updated">{result.updated}</p>
              </div>
              <div className="card-surface p-4 text-center">
                <p className="label-tiny">Dilewati</p>
                <p className="font-display num-display text-3xl font-extrabold text-[hsl(var(--muted))]" data-testid="import-skipped">
                  {result.skipped}
                </p>
              </div>
              {/* Always-visible so a page with zero errors still shows "Kesalahan" in the DOM --
                  previously this count only existed inside the conditional error block below,
                  same gap already fixed in GerainaOS (task "Fix bulk product import missing
                  error/Kesalahan count"). */}
              <div className="card-surface p-4 text-center">
                <p className="label-tiny">Kesalahan</p>
                <p className="font-display num-display text-3xl font-extrabold text-[hsl(var(--destructive))]" data-testid="import-error-count">
                  {result.errors?.length || 0}
                </p>
              </div>
            </div>
            {result.errors?.length > 0 && (
              <div className="mt-4 p-3 rounded-md bg-[hsl(var(--destructive))]/8" data-testid="import-errors-block">
                <p className="text-sm font-semibold flex items-center gap-1.5 mb-2 text-[hsl(var(--destructive))]">
                  <AlertCircle size={14} /> Error
                </p>
                <ul className="text-xs text-[hsl(var(--destructive))] space-y-1 max-h-40 overflow-y-auto">
                  {result.errors.map((errMsg, i) => <li key={`${i}-${errMsg.slice(0, 24)}`}>· {errMsg}</li>)}
                </ul>
              </div>
            )}
            <p className="text-sm text-[hsl(var(--success))] flex items-center gap-1.5 mt-4 font-semibold">
              <CheckCircle2 size={16} /> Impor selesai
            </p>
            <button onClick={finish} className="btn-primary w-full mt-4" data-testid="import-done-btn">Selesai</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Products() {
  const { user } = useAuth();
  const editable = canManageProducts(user?.role);
  const isDapurOS = true;
  const identity = `${user?.id || ''}:${user?.store_id || ''}`;
  const identityRef = useRef(identity); identityRef.current = identity;
  const [dialogIdentity,setDialogIdentity] = useState('');
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [categoriesIdentity, setCategoriesIdentity] = useState("");
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState("");
  const [units, setUnits] = useState([]);
  const [unitsIdentity, setUnitsIdentity] = useState("");
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [loadError,setLoadError]=useState('');
  useEffect(() => {
    const guard=event=>{if(editable && dialogIdentity===identity && (showForm || showImport))event.preventDefault();};
    window.addEventListener('dapuros-before-account-switch',guard);
    return()=>window.removeEventListener('dapuros-before-account-switch',guard);
  },[editable,dialogIdentity,identity,showForm,showImport]);

  const matches=useMemo(()=>items.filter(p=>(filterCat==='all'||p.category===filterCat)&&(!q.trim()||[p.name,p.sku,p.category].some(v=>String(v||'').toLocaleLowerCase('id').includes(q.trim().toLocaleLowerCase('id'))))),[items,q,filterCat]);
  const table=useTablePage(matches,25);

  // Same unsequenced-concurrent-request race fixed in GerainaOS's Products.jsx (commit
  // 9ab99b0): the 200ms debounce only cancels a *pending* timer, not a request already in
  // flight, so two overlapping GET /products calls (e.g. mid-typing vs. the final query) can
  // resolve out of order and let a stale, narrower result silently overwrite the correct one.
  // A monotonic reqId bumped at request-*issue* time fixes it -- only the response matching
  // the most recently issued request is ever applied.
  const loadReqIdRef = useRef(0);
  const categoriesReqIdRef=useRef(0),unitsReqIdRef=useRef(0);
  const load = async () => {
    setLoading(true);
    const reqId = ++loadReqIdRef.current;
    const requestIdentity=identity;
    try {
      const data = await loadCatalogue();
      if (reqId === loadReqIdRef.current && identityRef.current===requestIdentity) {setItems(data);setLoadError('');}
    } catch(e) {
      if(reqId===loadReqIdRef.current && identityRef.current===requestIdentity)setLoadError('Katalog belum dapat diperbarui. Periksa koneksi lalu coba lagi.');
    } finally {
      if (reqId === loadReqIdRef.current && identityRef.current===requestIdentity) setLoading(false);
    }
  };

  // Saved categories must be available before their first product is created.
  // Keep legacy/imported product names too, so existing values remain selectable.
  const loadCategories = async () => {
    const requestIdentity = identity;
    const requestId = ++categoriesReqIdRef.current;
    const current = () => identityRef.current === requestIdentity && categoriesReqIdRef.current === requestId;
    setCategoriesLoading(true); setCategoriesError("");
    try {
      const [saved, used] = await Promise.all([readCollection("/products/categories"), api.get("/products/category-names")]);
      if (!Array.isArray(used.data)) throw new Error("Jawaban kategori tidak valid.");
      const names = [...new Set([...saved.data.map(category => category.name), ...used.data]
        .filter(name => typeof name === "string" && name.trim()))].sort((a, b) => a.localeCompare(b, "id"));
      if (current()) { setCategories(names); setCategoriesIdentity(requestIdentity); }
    } catch {
      if (current()) setCategoriesError("Daftar kategori belum dapat dimuat.");
    } finally {
      if (current()) setCategoriesLoading(false);
    }
  };

  const loadUnits = async () => {
    const requestIdentity = identity;
    const requestId = ++unitsReqIdRef.current;
    const current = () => identityRef.current === requestIdentity && unitsReqIdRef.current === requestId;
    setUnitsLoading(true); setUnitsError("");
    try {
      const saved = await readCollection("/products/units");
      const choices = new Map();
      for (const unit of saved.data) {
        const value = typeof unit.short_name === "string" ? unit.short_name.trim() : "";
        const name = typeof unit.name === "string" ? unit.name.trim() : "";
        if (value && !choices.has(value)) choices.set(value, { value, label: name && name !== value ? `${name} (${value})` : value });
      }
      if (current()) { setUnits([...choices.values()]); setUnitsIdentity(requestIdentity); }
    } catch {
      if (current()) setUnitsError("Daftar satuan belum dapat dimuat.");
    } finally {
      if (current()) setUnitsLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setItems([]);setCategories([]);setCategoriesIdentity('');setUnits([]);setUnitsIdentity('');
    setCategoriesError('');setUnitsError('');setUnitsLoading(false);setQ('');setFilterCat('all');
    setShowForm(false);setShowImport(false);setEditing(null);load();loadCategories();
    return()=>{loadReqIdRef.current++;categoriesReqIdRef.current++;unitsReqIdRef.current++;};
  },[identity]);
  const visibleCategories=categoriesIdentity===identity?categories:[];
  const visibleUnits=unitsIdentity===identity?units:[];

  const remove = async (p) => {
    if (!window.confirm(`Hapus "${p.name}"?`)) return;
    try{await api.delete(`/products/${p.id}`);load();}
    catch(e){toast.error(typeof e?.response?.data?.detail==='string'?e.response.data.detail:'Menu belum dapat dihapus. Coba lagi.');}
  };

  return (
    <div className="p-8 space-y-5" data-testid="products-page">
      <div className="flex items-end justify-between">
        <div>
          <span className="label-tiny">Manajemen</span>
          <h1 className="font-display text-3xl font-bold mt-1">Produk</h1>
        </div>
        {editable && <div className="flex gap-2">
          <button onClick={() => {setDialogIdentity(identity);setShowImport(true);}} className="btn-outline" data-testid="open-import-btn">
            <Upload size={16} /> Impor Excel/CSV
          </button>
          <button onClick={() => { setDialogIdentity(identity); setEditing(null); setShowForm(true); loadCategories(); loadUnits(); }} className="btn-primary" data-testid="new-product-btn">
            <Plus size={16} /> Produk Baru
          </button>
        </div>}
      </div>

      <div className="card-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted))]" />
            <input
              className="input-field pl-9"
              placeholder="Cari nama produk…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              data-testid="products-search"
            />
          </div>
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="input-field w-48"
            data-testid="products-category-filter"
          >
            <option value="all">Semua Kategori</option>
            {visibleCategories.map((c) => {
              const name = typeof c === "string" ? c : c.name;
              return <option key={name} value={name}>{name}</option>;
            })}
          </select>
        </div>
      </div>

      <ReadState loading={false} error={loadError} retry={load} testid="products-read-state" />
      <div className="card-surface overflow-x-auto">
        <table className="w-full text-sm" data-testid="products-table">
          <thead className="bg-[hsl(var(--background))] border-b border-[hsl(var(--border))]">
            <tr className="text-left">
              <th className="px-5 py-3 label-tiny">Nama</th>
              <th className="px-5 py-3 label-tiny">SKU</th>
              <th className="px-5 py-3 label-tiny">Kategori</th>
              <th className="px-5 py-3 label-tiny text-right">Harga</th>
              <th className="px-5 py-3 label-tiny text-right">Stok</th>
              <th className="px-5 py-3 label-tiny text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[hsl(var(--border))]">
            {loading && (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-[hsl(var(--muted))]" data-testid="products-loading">Memuat…</td></tr>
            )}
            {!loading && !loadError && matches.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-[hsl(var(--muted))]" data-testid="products-empty">Belum ada produk.</td></tr>
            )}
            {table.rows.map((p) => (
              <tr key={p.id} className="hover:bg-[hsl(var(--background))]" data-testid={`product-row-${p.id}`}>
                <td className="px-5 py-3 font-medium flex items-center gap-2.5">
                  {p.image_url ? (
                    <img src={p.image_url} alt="" loading="lazy" decoding="async" className="w-8 h-8 rounded-md object-cover border border-slate-200 shrink-0" />
                  ) : (
                    <span className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center text-slate-300 text-[10px]">—</span>
                  )}
                  <span>{p.name}</span>
                  {isDapurOS && p.recipe && p.recipe.length > 0 && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      BOM
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-[hsl(var(--muted))] text-xs">{p.sku || "—"}</td>
                <td className="px-5 py-3"><span className="pill pill-muted">{p.category}</span></td>
                <td className="px-5 py-3 text-right font-display font-bold num-display">{fmtIDR(p.price)}</td>
                <td className="px-5 py-3 text-right num-display">
                  {p.recipe?.length ? (p.available_portions == null ? "—" : `${p.available_portions} porsi`)
                    : <>{p.stock} <span className="text-xs text-[hsl(var(--muted))]">{p.unit}</span></>}
                </td>
                <td className="px-5 py-3 text-right">
                  {editable&&<><button onClick={() => { setDialogIdentity(identity); setEditing(p); setShowForm(true); loadCategories(); loadUnits(); }} className="btn-ghost p-1.5" data-testid={`edit-product-${p.id}`}><Edit3 size={15} /></button>
                  <button onClick={() => remove(p)} className="btn-ghost p-1.5 text-[hsl(var(--destructive))]" data-testid={`delete-product-${p.id}`}><Trash2 size={15} /></button></>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading&&!loadError&&<TablePage value={table} label="menu"/>}
      {editable && showForm && dialogIdentity===identity && <ProductForm key={dialogIdentity} product={editing} categories={visibleCategories} categoriesLoading={categoriesLoading} categoriesError={categoriesError} onRetryCategories={loadCategories} productUnits={visibleUnits} unitsLoading={unitsLoading} unitsError={unitsError} onRetryUnits={loadUnits} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); loadCategories(); }} />}
      {editable && showImport && dialogIdentity===identity && <ImportDialog onClose={() => setShowImport(false)} onDone={load} />}
    </div>
  );
}
