import { useState, useEffect } from "react";
import api from "@/api/client";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, Smartphone, Printer, Download, ShoppingBag, Send, CheckCircle2, Coffee, Sparkles, Plus, Minus } from "lucide-react";

const DEFAULT_PRODUCTS = [
  { id: "prod-1", name: "Kopi Susu Gula Aren", price: 22000, category: "Minuman", description: "Espresso dengan susu segar dan gula aren asli" },
  { id: "prod-2", name: "Nasi Goreng Spesial Dapur", price: 35000, category: "Makanan Utama", description: "Nasi goreng bumbu rempah dengan telor ceplok dan ayam suwir" },
  { id: "prod-3", name: "Pizza Mozzarella 8 Inci", price: 48000, category: "Makanan Utama", description: "Pizza panggang oven kayu dengan lelehan keju mozzarella" },
  { id: "prod-4", name: "Iced Milk Tea Boba", price: 25000, category: "Minuman", description: "Teh susu dingin beraroma wangi dengan kenyalnya boba" },
];

export default function QrMenu() {
  const [floors, setFloors] = useState([
    { id: "fl-main", name: "Lantai 1 (Utama)" },
    { id: "fl-vip", name: "Lantai 2 (VIP Sofa)" },
    { id: "fl-rooftop", name: "Rooftop (Outdoor)" }
  ]);
  const [tables, setTables] = useState([
    { id: "tbl-01", floor_id: "fl-main", label: "Meja 01" },
    { id: "tbl-02", floor_id: "fl-main", label: "Meja 02" },
    { id: "tbl-v1", floor_id: "fl-vip", label: "VIP Sofa A" },
    { id: "tbl-r1", floor_id: "fl-rooftop", label: "Outdoor 01" }
  ]);
  const [selectedTableId, setSelectedTableId] = useState("tbl-01");
  const [products, setProducts] = useState(DEFAULT_PRODUCTS);
  
  // Customer simulator cart state
  const [cart, setCart] = useState([]);
  const [sugar, setSugar] = useState("Normal");
  const [ice, setIce] = useState("Normal");
  const [customNote, setCustomNote] = useState("");
  const [orderSentSuccess, setOrderSentSuccess] = useState(false);

  useEffect(() => {
    api.get("/floors").then((r) => { if (r.data?.length) setFloors(r.data); }).catch(() => {});
    api.get("/tables").then((r) => { if (r.data?.length) setTables(r.data); }).catch(() => {});
    api.get("/products").then((r) => { if (r.data?.length) setProducts(r.data); }).catch(() => {});
  }, []);

  const selectedTable = tables.find(t => t.id === selectedTableId) || tables[0];
  const qrUrl = typeof window !== "undefined" ? `${window.location.origin}/dapuros/qr-order?table=${selectedTable.id}` : `https://dagangos.com/dapuros/qr-order?table=${selectedTable.id}`;

  const addToCart = (prod) => {
    setCart(prev => {
      const exist = prev.find(item => item.id === prod.id);
      if (exist) {
        return prev.map(item => item.id === prod.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...prod, qty: 1, sugar, ice, note: customNote }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const calculateTotal = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const tax = subtotal * 0.10;
    const service = subtotal * 0.05;
    return { subtotal, tax, service, grandTotal: subtotal + tax + service };
  };

  const handleSendSelfOrder = async () => {
    if (cart.length === 0) return;
    try {
      const payload = {
        order_type: "dine_in",
        table_id: selectedTable.id,
        items: cart.map(c => ({
          product_id: c.id,
          name: c.name,
          price: c.price,
          qty: c.qty,
          notes: `Gula: ${c.sugar}, Es: ${c.ice}${c.note ? `, Catatan: ${c.note}` : ""}`
        }))
      };
      await api.post("/orders", payload);
    } catch (e) {
      console.log("Mock order sent");
    }
    setOrderSentSuccess(true);
    setTimeout(() => {
      setOrderSentSuccess(false);
      setCart([]);
    }, 4000);
  };

  const fmtIDR = (val) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);

  return (
    <div className="p-6 space-y-6 text-left" data-testid="qr-menu-page">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <QrCode className="text-[hsl(var(--primary))]" /> Menu QR Code & Self-Order Digital
          </h1>
          <p className="text-xs text-[hsl(var(--muted))] mt-1">
            Generate kode QR akrilik untuk meja restoran dan nikmati integrasi otomatis pemesanan langsung ke Layar Dapur (KDS).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left: QR Code Generator per Table */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          <div className="card-surface bg-white p-6 rounded-2xl border border-[hsl(var(--border))] shadow-sm space-y-5">
            <h2 className="font-display text-base font-bold flex items-center gap-2 border-b pb-3 border-[hsl(var(--border))]">
              <Printer size={18} className="text-amber-600" /> Pengaturan QR Standee Meja
            </h2>

            <div>
              <label className="label-tiny block mb-1.5">Pilih Meja Restoran</label>
              <select
                value={selectedTableId}
                onChange={(e) => setSelectedTableId(e.target.value)}
                className="input-field py-2 text-sm font-semibold w-full"
              >
                {tables.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col items-center justify-center p-6 bg-slate-900 text-white rounded-2xl border border-slate-800 text-center space-y-4">
              <span className="text-xs font-bold uppercase tracking-widest text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">
                Pindai Untuk Memesan — {selectedTable.label}
              </span>

              <div className="p-4 bg-white rounded-xl shadow-xl">
                <QRCodeSVG value={qrUrl} size={180} level="H" includeMargin={true} />
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-300">Meja: <span className="text-white font-bold">{selectedTable.label}</span></p>
                <p className="text-[10px] text-slate-400 truncate max-w-[260px] mx-auto">{qrUrl}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button onClick={() => window.print()} className="btn-outline flex items-center justify-center gap-2 py-2.5 text-xs font-bold">
                <Printer size={15} /> Cetak Standee
              </button>
              <button onClick={() => alert(`URL QR Code Meja: ${qrUrl}`)} className="btn-primary flex items-center justify-center gap-2 py-2.5 text-xs font-bold">
                <Download size={15} /> Salin Tautan
              </button>
            </div>
          </div>
        </div>

        {/* Right: Live Customer Phone Simulator */}
        <div className="col-span-12 lg:col-span-7">
          <div className="card-surface bg-slate-950 text-white p-6 rounded-2xl border border-slate-800 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Smartphone className="text-amber-400" size={20} />
                <div>
                  <h3 className="font-display font-bold text-base text-slate-100">Simulasi Layar HP Tamu</h3>
                  <p className="text-[11px] text-slate-400">Tampilan seluler saat tamu memindai QR {selectedTable.label}</p>
                </div>
              </div>
              <span className="pill bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] px-2.5 py-1 font-mono">Live Demo</span>
            </div>

            {orderSentSuccess ? (
              <div className="py-16 text-center space-y-4 animate-fadein">
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full grid place-items-center mx-auto">
                  <CheckCircle2 size={36} />
                </div>
                <h3 className="font-display text-xl font-bold text-white">Pesanan Terkirim ke Dapur!</h3>
                <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                  Pesanan untuk <strong className="text-amber-400">{selectedTable.label}</strong> telah masuk ke layar monitor KDS Dapur Utama secara otomatis.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Modifiers Selector */}
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 flex items-center gap-1">
                    <Sparkles size={12} /> Opsi Pengatur Resep (Modifiers)
                  </span>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Tingkat Gula (Sugar)</label>
                      <div className="flex gap-1">
                        {["Normal", "Less", "Zero"].map(s => (
                          <button
                            key={s}
                            onClick={() => setSugar(s)}
                            className={`flex-1 py-1 rounded text-[10px] font-bold border transition-all ${sugar === s ? "bg-amber-500 text-slate-950 border-amber-400" : "bg-slate-950 text-slate-300 border-slate-800"}`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Tingkat Es (Ice)</label>
                      <div className="flex gap-1">
                        {["Normal", "Less", "No Ice"].map(i => (
                          <button
                            key={i}
                            onClick={() => setIce(i)}
                            className={`flex-1 py-1 rounded text-[10px] font-bold border transition-all ${ice === i ? "bg-amber-500 text-slate-950 border-amber-400" : "bg-slate-950 text-slate-300 border-slate-800"}`}
                          >
                            {i}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Digital Menu Items Catalog */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Pilih Menu Hidangan</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {products.map(p => (
                      <div key={p.id} className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col justify-between space-y-2 hover:border-slate-700 transition-all">
                        <div>
                          <p className="font-bold text-sm text-slate-100">{p.name}</p>
                          <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{p.description}</p>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <span className="font-bold text-amber-400 text-xs font-mono">{fmtIDR(p.price)}</span>
                          <button
                            onClick={() => addToCart(p)}
                            className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                          >
                            <Plus size={13} /> Tambah
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Customer Cart Drawer Summary */}
                {cart.length > 0 && (
                  <div className="bg-slate-900 border border-amber-500/40 p-4 rounded-xl space-y-3 animate-fadein">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-bold text-xs text-amber-400 flex items-center gap-1.5">
                        <ShoppingBag size={14} /> Pesanan Tamu ({selectedTable.label})
                      </span>
                      <span className="text-[10px] text-slate-400">{cart.reduce((s, i) => s + i.qty, 0)} Item</span>
                    </div>

                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {cart.map(item => (
                        <div key={item.id} className="flex items-center justify-between text-xs py-1">
                          <div>
                            <p className="font-bold text-slate-200">{item.name}</p>
                            <p className="text-[10px] text-amber-400/80">Gula: {item.sugar}, Es: {item.ice}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded">
                              <button onClick={() => updateQty(item.id, -1)} className="text-slate-400 hover:text-white"><Minus size={11} /></button>
                              <span className="font-bold text-xs px-1 text-white">{item.qty}</span>
                              <button onClick={() => updateQty(item.id, 1)} className="text-slate-400 hover:text-white"><Plus size={11} /></button>
                            </div>
                            <span className="font-mono font-bold text-slate-200 text-xs">{fmtIDR(item.price * item.qty)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-slate-800 pt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-400"><span>Pajak PB1 (10%) & Service (5%)</span><span>{fmtIDR(calculateTotal().tax + calculateTotal().service)}</span></div>
                      <div className="flex justify-between font-bold text-sm text-white pt-1">
                        <span>Total Bayar</span>
                        <span className="text-amber-400 font-mono text-base">{fmtIDR(calculateTotal().grandTotal)}</span>
                      </div>
                    </div>

                    <button
                      onClick={handleSendSelfOrder}
                      className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
                    >
                      <Send size={15} /> Kirim Pesanan Langsung Ke Dapur
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
