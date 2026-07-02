import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import api, { fmtIDR, downloadPdf } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import {
  Search, Plus, Minus, Trash2, X, Printer, Download, CheckCircle2,
  Banknote, QrCode, Smartphone, RefreshCw, Barcode, Store, ChefHat,
  CreditCard, ChevronRight, Layers, ArrowLeft, RefreshCw as LoopIcon, Wifi, WifiOff, Edit, Edit3
} from "lucide-react";

const EWALLET_CHANNELS = [
  { code: "ID_OVO", label: "OVO" },
  { code: "ID_DANA", label: "DANA" },
  { code: "ID_SHOPEEPAY", label: "ShopeePay" },
  { code: "ID_LINKAJA", label: "LinkAja" },
];

function ReceiptDialog({ order, onClose }) {
  const [poll, setPoll] = useState(order);
  useEffect(() => {
    if (poll?.payment_status === "paid" || poll?.payment_method === "cash") return;
    const t = setInterval(async () => {
      try {
        const r = await api.get(`/orders/${poll.id}`);
        setPoll(r.data);
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[POS] poll order status failed", err);
        }
      }
    }, 3500);
    return () => clearInterval(t);
  }, [poll?.id, poll?.payment_status, poll?.payment_method]);

  const o = poll;
  const isPaid = o.payment_status === "paid";

  const simulatePaid = async () => {
    await api.post(`/orders/${o.id}/mark-paid`);
    const r = await api.get(`/orders/${o.id}`);
    setPoll(r.data);
  };

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" data-testid="receipt-dialog">
      <div className="card-surface bg-white w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="label-tiny">Struk</span>
            <p className="font-display text-xl font-bold" data-testid="receipt-order-no">{o.order_no}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2" data-testid="receipt-close"><X size={18} /></button>
        </div>

        <div className="text-center mb-4">
          {isPaid ? (
            <span className="pill pill-success" data-testid="receipt-status">
              <CheckCircle2 size={12} /> Lunas
            </span>
          ) : (
            <span className="pill pill-warning" data-testid="receipt-status">Menunggu pembayaran…</span>
          )}
        </div>

        {o.payment_method === "qris" && o.xendit_qr_string && !isPaid && (
          <div className="text-center mb-4" data-testid="qris-display">
            <div className="inline-block p-4 bg-white border border-[hsl(var(--border))] rounded-lg">
              <QRCodeSVG value={o.xendit_qr_string} size={200} level="M" />
            </div>
            <p className="text-xs text-[hsl(var(--muted))] mt-2">Scan QRIS untuk membayar</p>
          </div>
        )}

        {o.payment_method === "ewallet" && o.xendit_checkout_url && !isPaid && (
          <div className="text-center mb-4" data-testid="ewallet-display">
            <p className="text-sm mb-2">Lanjutkan pembayaran di:</p>
            <a href={o.xendit_checkout_url} target="_blank" rel="noreferrer" className="btn-accent" data-testid="ewallet-open-link">
              Buka {o.ewallet_channel}
            </a>
          </div>
        )}

        <div className="divide-y divide-[hsl(var(--border))] text-sm mb-3 max-h-48 overflow-y-auto">
          {o.items.map((it, i) => (
            <div key={`${it.product_id}-${i}`} className="py-2 flex justify-between" data-testid={`receipt-item-${i}`}>
              <div>
                <p className="font-medium">{it.name}</p>
                {it.note && <p className="text-[10px] text-amber-600 italic">"{it.note}"</p>}
                <p className="text-xs text-[hsl(var(--muted))]">{it.quantity} × {fmtIDR(it.price)}</p>
              </div>
              <p className="font-display font-bold num-display">{fmtIDR(it.subtotal)}</p>
            </div>
          ))}
        </div>

        <div className="space-y-1 text-sm pt-3 border-t border-[hsl(var(--border))]">
          <div className="flex justify-between"><span className="text-[hsl(var(--muted))]">Subtotal</span><span className="num-display">{fmtIDR(o.subtotal)}</span></div>
          {o.discount > 0 && <div className="flex justify-between"><span className="text-[hsl(var(--muted))]">Diskon</span><span className="num-display">-{fmtIDR(o.discount)}</span></div>}
          
          {/* F&B Taxes Display */}
          {o.service_charge > 0 ? (
            <>
              <div className="flex justify-between"><span className="text-[hsl(var(--muted))]">Service Charge (5%)</span><span className="num-display">{fmtIDR(o.service_charge)}</span></div>
              <div className="flex justify-between"><span className="text-[hsl(var(--muted))]">Pajak PB1 (10%)</span><span className="num-display">{fmtIDR(o.tax_pb1)}</span></div>
            </>
          ) : (
            o.tax_amount > 0 && <div className="flex justify-between"><span className="text-[hsl(var(--muted))]">PPN {o.tax_percent}%</span><span className="num-display">{fmtIDR(o.tax_amount)}</span></div>
          )}
          
          <div className="flex justify-between font-display text-lg font-bold text-[hsl(var(--primary))] mt-2">
            <span>TOTAL</span><span className="num-display" data-testid="receipt-total">{fmtIDR(o.total)}</span>
          </div>
          {o.payment_method === "cash" && o.cash_received != null && (
            <>
              <div className="flex justify-between text-xs text-[hsl(var(--muted))]"><span>Tunai</span><span className="num-display">{fmtIDR(o.cash_received)}</span></div>
              <div className="flex justify-between text-xs text-[hsl(var(--muted))]"><span>Kembalian</span><span className="num-display">{o.change ? fmtIDR(o.change) : "Rp 0"}</span></div>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-5">
          <button onClick={() => downloadPdf(`/pdf/receipt/${o.id}`, `receipt-${o.order_no}.pdf`)} className="btn-outline" data-testid="receipt-pdf-thermal-btn">
            <Printer size={15} /> Struk PDF
          </button>
          <button onClick={() => downloadPdf(`/pdf/invoice/${o.id}`, `invoice-${o.order_no}.pdf`)} className="btn-outline" data-testid="receipt-pdf-invoice-btn">
            <Download size={15} /> Invoice A4
          </button>
        </div>

        {!isPaid && o.payment_method !== "cash" && (
          <button onClick={simulatePaid} className="btn-ghost w-full mt-2 text-xs" data-testid="receipt-simulate-paid">
            <RefreshCw size={13} /> Simulasi: tandai lunas
          </button>
        )}

        <button onClick={onClose} className="btn-primary w-full mt-3" data-testid="receipt-done-btn">Selesai</button>
      </div>
    </div>
  );
}

const DEFAULT_PRODUCTS = [
  { id: "prod-1", name: "Kopi Susu Gula Aren", price: 22000, category: "Minuman", stock: 50, recipe: [{ ingredient: "Biji Kopi", qty: 15 }] },
  { id: "prod-2", name: "Nasi Goreng Spesial Dapur", price: 35000, category: "Makanan Utama", stock: 40, recipe: [{ ingredient: "Beras", qty: 150 }] },
  { id: "prod-3", name: "Pizza Mozzarella 8 Inci", price: 48000, category: "Makanan Utama", stock: 25, recipe: [{ ingredient: "Keju Mozzarella", qty: 100 }] },
  { id: "prod-4", name: "Iced Milk Tea Boba", price: 25000, category: "Minuman", stock: 60, recipe: [{ ingredient: "Fresh Milk UHT", qty: 200 }] },
  { id: "prod-5", name: "Chicken Steak Crispy", price: 42000, category: "Makanan Utama", stock: 30, recipe: [{ ingredient: "Daging Ayam", qty: 1 }] },
];

const DEFAULT_FLOORS = [
  { id: "fl-main", name: "Lantai 1 (Utama)", level: 1 },
  { id: "fl-vip", name: "Lantai 2 (VIP Sofa)", level: 2 },
  { id: "fl-rooftop", name: "Rooftop (Outdoor)", level: 3 },
];

const DEFAULT_TABLES = [
  { id: "tbl-01", floor_id: "fl-main", label: "Meja 01", capacity: 2, status: "Vacant" },
  { id: "tbl-02", floor_id: "fl-main", label: "Meja 02", capacity: 4, status: "Seated" },
  { id: "tbl-03", floor_id: "fl-main", label: "Meja 03", capacity: 4, status: "Dining" },
  { id: "tbl-04", floor_id: "fl-main", label: "Meja 04", capacity: 6, status: "Billing" },
  { id: "tbl-05", floor_id: "fl-main", label: "Meja 05", capacity: 6, status: "Vacant" },
  { id: "tbl-06", floor_id: "fl-main", label: "Meja Bar 01", capacity: 2, status: "Vacant" },
  
  { id: "tbl-v1", floor_id: "fl-vip", label: "VIP Sofa A", capacity: 8, status: "Dining" },
  { id: "tbl-v2", floor_id: "fl-vip", label: "VIP Sofa B", capacity: 8, status: "Vacant" },

  { id: "tbl-r1", floor_id: "fl-rooftop", label: "Outdoor 01", capacity: 2, status: "Vacant" },
  { id: "tbl-r2", floor_id: "fl-rooftop", label: "Outdoor 02", capacity: 4, status: "Vacant" },
  { id: "tbl-r3", floor_id: "fl-rooftop", label: "Outdoor 03", capacity: 2, status: "Vacant" },
];

export default function POS() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState("floor"); // floor | catalog
  
  // Floors and Tables state
  const [floors, setFloors] = useState(DEFAULT_FLOORS);
  const [selectedFloorId, setSelectedFloorId] = useState("fl-main");
  const [tables, setTables] = useState(DEFAULT_TABLES);
  const [selectedTable, setSelectedTable] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [websocketConnected, setWebsocketConnected] = useState(false);
  
  // Catalog & Cart state
  const [products, setProducts] = useState(DEFAULT_PRODUCTS);
  const [q, setQ] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("cash"); // cash | qris | ewallet | edc
  const [ewallet, setEwallet] = useState("ID_DANA");
  const [cashReceived, setCashReceived] = useState("");
  const [taxPercent, setTaxPercent] = useState(0); // for retail takeaway
  const [discount, setDiscount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [categories, setCategories] = useState(["Makanan Utama", "Minuman", "Cemilan", "Dessert"]);
  const [activeCat, setActiveCat] = useState("all");
  const [scannedProduct, setScannedProduct] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  
  // Custom EDC Simulator State
  const [edcSimulating, setEdcSimulating] = useState(false);
  const [edcTimer, setEdcTimer] = useState(3);
  const [edcSplitSimulating, setEdcSplitSimulating] = useState(false);
  
  // Split bill states
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitType, setSplitType] = useState("equal"); // equal | item
  const [splitWays, setSplitWays] = useState(2);
  const [splitEqualResult, setSplitEqualResult] = useState(null);
  const [splitQuantities, setSplitQuantities] = useState({}); // { product_id: split_qty }
  const [splitOrderResult, setSplitOrderResult] = useState(null);

  // Table Management Modal States
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [tableForm, setTableForm] = useState({ label: "", capacity: 4, floor_id: "", shape: "rectangle" });

  // Floor Management Modal States
  const [floorModalOpen, setFloorModalOpen] = useState(false);
  const [floorForm, setFloorForm] = useState({ name: "", level: 1 });

  // Product Management Modal States
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({ name: "", price: 25000, category: "Makanan Utama", stock: 50 });

  const handleManualBarcodeScan = (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    const matched = products.find(p => p.sku === barcodeInput.trim() || p.id === barcodeInput.trim() || p.name.toLowerCase().includes(barcodeInput.trim().toLowerCase()));
    if (matched) {
      addToCart(matched);
      setScannedProduct(matched);
      setTimeout(() => setScannedProduct(null), 3000);
      setBarcodeInput("");
    } else {
      alert(`Menu / Barcode "${barcodeInput}" tidak ditemukan`);
    }
  };

  const handleOpenAddTable = () => {
    setEditingTable(null);
    setTableForm({ label: `Meja ${tables.length + 1}`, capacity: 4, floor_id: selectedFloorId || (floors[0]?.id || "fl-main"), shape: "rectangle" });
    setTableModalOpen(true);
  };

  const handleOpenEditTable = (t, e) => {
    if (e) e.stopPropagation();
    setEditingTable(t);
    setTableForm({ label: t.label, capacity: t.capacity, floor_id: t.floor_id, shape: t.shape || "rectangle" });
    setTableModalOpen(true);
  };

  const handleSaveTable = async (e) => {
    e.preventDefault();
    if (!tableForm.label.trim()) return;
    const payload = { ...tableForm, capacity: parseInt(tableForm.capacity) || 2 };
    try {
      if (editingTable) {
        await api.put(`/tables/${editingTable.id}`, payload);
        setTables(prev => prev.map(t => t.id === editingTable.id ? { ...t, ...payload } : t));
        if (selectedTable?.id === editingTable.id) setSelectedTable(prev => ({ ...prev, ...payload }));
      } else {
        const res = await api.post("/tables", payload);
        const newT = res.data && res.data.id ? res.data : { id: `tbl-${Date.now()}`, ...payload, status: "Vacant" };
        setTables(prev => [...prev, newT]);
      }
    } catch (err) {
      if (editingTable) {
        setTables(prev => prev.map(t => t.id === editingTable.id ? { ...t, ...payload } : t));
        if (selectedTable?.id === editingTable.id) setSelectedTable(prev => ({ ...prev, ...payload }));
      } else {
        const newT = { id: `tbl-${Date.now()}`, ...payload, status: "Vacant" };
        setTables(prev => [...prev, newT]);
      }
    } finally {
      setTableModalOpen(false);
    }
  };

  const handleDeleteTable = async (tableId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Apakah Anda yakin ingin menghapus meja ini?")) return;
    try {
      await api.delete(`/tables/${tableId}`);
    } catch (err) {}
    setTables(prev => prev.filter(t => t.id !== tableId));
    if (selectedTable?.id === tableId) setSelectedTable(null);
  };

  const handleOpenAddFloor = () => {
    setFloorForm({ name: `Lantai ${floors.length + 1}`, level: floors.length + 1 });
    setFloorModalOpen(true);
  };

  const handleSaveFloor = async (e) => {
    e.preventDefault();
    if (!floorForm.name.trim()) return;
    const payload = { name: floorForm.name, level: parseInt(floorForm.level) || 1 };
    try {
      const res = await api.post("/floors", payload);
      const newFl = res.data && res.data.id ? res.data : { id: `fl-${Date.now()}`, ...payload };
      setFloors(prev => [...prev, newFl]);
      setSelectedFloorId(newFl.id);
    } catch (err) {
      const newFl = { id: `fl-${Date.now()}`, ...payload };
      setFloors(prev => [...prev, newFl]);
      setSelectedFloorId(newFl.id);
    } finally {
      setFloorModalOpen(false);
    }
  };

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductForm({ name: "", price: 25000, category: activeCat !== "all" ? activeCat : "Makanan Utama", stock: 50 });
    setProductModalOpen(true);
  };

  const handleOpenEditProduct = (p, e) => {
    if (e) e.stopPropagation();
    setEditingProduct(p);
    setProductForm({ name: p.name, price: p.price, category: p.category, stock: p.stock });
    setProductModalOpen(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!productForm.name.trim()) return;
    const payload = { ...productForm, price: parseFloat(productForm.price) || 0, stock: parseInt(productForm.stock) || 0 };
    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload);
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, ...payload } : p));
      } else {
        const res = await api.post("/products", payload);
        const newP = res.data && res.data.id ? res.data : { id: `prod-${Date.now()}`, ...payload };
        setProducts(prev => [...prev, newP]);
      }
    } catch (err) {
      if (editingProduct) {
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, ...payload } : p));
      } else {
        const newP = { id: `prod-${Date.now()}`, ...payload };
        setProducts(prev => [...prev, newP]);
      }
    } finally {
      setProductModalOpen(false);
    }
  };

  const handleDeleteProduct = async (productId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Apakah Anda yakin ingin menghapus menu produk ini?")) return;
    try {
      await api.delete(`/products/${productId}`);
    } catch (err) {}
    setProducts(prev => prev.filter(p => p.id !== productId));
  };

  const loadFloors = async () => {
    try {
      const res = await api.get("/floors");
      if (res.data && res.data.length > 0) {
        setFloors(res.data);
        if (!selectedFloorId || !res.data.some(f => f.id === selectedFloorId)) {
          setSelectedFloorId(res.data[0].id);
        }
      } else {
        setFloors(DEFAULT_FLOORS);
        if (!selectedFloorId) setSelectedFloorId(DEFAULT_FLOORS[0].id);
      }
    } catch (e) {
      setFloors(DEFAULT_FLOORS);
      if (!selectedFloorId) setSelectedFloorId(DEFAULT_FLOORS[0].id);
    }
  };

  const loadTables = async () => {
    try {
      const res = await api.get("/tables");
      if (res.data && res.data.length > 0) {
        setTables(res.data);
      } else {
        setTables(DEFAULT_TABLES);
      }
    } catch (e) {
      setTables(DEFAULT_TABLES);
    }
  };

  const loadActiveTableSession = async (tableId) => {
    try {
      const res = await api.get(`/tables/${tableId}/session`);
      if (res.data && Array.isArray(res.data.items)) {
        setActiveSession(res.data);
      } else if (res.data && res.data.session && Array.isArray(res.data.items)) {
        setActiveSession(res.data);
      } else {
        setActiveSession({ id: `sess-${tableId}`, table_id: tableId, items: [], subtotal: 0, service_charge: 0, tax_pb1: 0, grand_total: 0 });
      }
    } catch (e) {
      setActiveSession({ id: `sess-${tableId}`, table_id: tableId, items: [], subtotal: 0, service_charge: 0, tax_pb1: 0, grand_total: 0 });
    }
  };

  const initData = async () => {
    await loadFloors();
    await loadTables();
    api.get("/products").then((r) => {
      if (r.data && Array.isArray(r.data) && r.data.length > 0) setProducts(r.data);
      else setProducts(DEFAULT_PRODUCTS);
    }).catch(() => setProducts(DEFAULT_PRODUCTS));
    api.get("/products/category-names").then((r) => {
      const names = (Array.isArray(r.data) ? r.data : [])
        .map((c) => (typeof c === "string" ? c : c?.name))
        .filter(Boolean);
      if (names.length > 0) setCategories(names);
      else setCategories(["Makanan Utama", "Minuman", "Cemilan", "Dessert"]);
    }).catch(() => setCategories(["Makanan Utama", "Minuman", "Cemilan", "Dessert"]));
    api.get("/customers").then((r) => setCustomers(r.data)).catch(() => {});
  };

  useEffect(() => {
    initData();
  }, []);

  // WebSocket Sync
  useEffect(() => {
    if (!user?.store_id) return;
    
    let ws;
    let pollInterval;

    const connectWs = () => {
      const envUrl = process.env.REACT_APP_BACKEND_URL;
      let backendHost = "localhost:8000";
      if (envUrl && envUrl !== "undefined" && envUrl !== "") {
        backendHost = envUrl.replace(/https?:\/\//, "");
      } else if (!window.location.origin.includes("localhost")) {
        backendHost = window.location.host || "dagangos.com";
      }
      
      const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProto}//${backendHost}/api/ws/${user.store_id}`;
      
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        setWebsocketConnected(true);
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "TABLE_UPDATE" || data.type === "ORDER_CREATE") {
          loadTables();
          if (selectedTable) {
            loadActiveTableSession(selectedTable.id);
          }
        }
      };
      
      ws.onclose = () => {
        setWebsocketConnected(false);
        if (!pollInterval) {
          pollInterval = setInterval(() => {
            loadTables();
            if (selectedTable) {
              loadActiveTableSession(selectedTable.id);
            }
          }, 3000);
        }
      };
      
      ws.onerror = () => {
        ws.close();
      };
    };

    connectWs();

    return () => {
      if (ws) ws.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [user?.store_id, selectedTable?.id]);

  // Keyboard barcode scanner
  useEffect(() => {
    let chars = [];
    let lastTime = Date.now();

    const handleKeyDown = (e) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        return;
      }
      const now = Date.now();
      if (e.key.length > 1 && e.key !== "Enter") return;

      if (now - lastTime > 50) {
        chars = [];
      }
      lastTime = now;

      if (e.key === "Enter") {
        if (chars.length > 0) {
          const barcode = chars.join("").trim();
          const matched = products.find(p => p.sku === barcode || p.id === barcode);
          if (matched) {
            addToCart(matched);
            setScannedProduct(matched);
            setTimeout(() => setScannedProduct(null), 3000);
            e.preventDefault();
          }
        }
        chars = [];
      } else {
        chars.push(e.key);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [products]);

  const filtered = useMemo(() => {
    let arr = products;
    if (activeCat !== "all") arr = arr.filter((p) => p.category === activeCat);
    if (q) arr = arr.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || p.sku?.toLowerCase().includes(q.toLowerCase()));
    return arr;
  }, [products, activeCat, q]);

  const addToCart = (p) => {
    setCart((c) => {
      const i = c.findIndex((it) => it.product_id === p.id);
      if (i >= 0) {
        const copy = [...c];
        copy[i] = { ...copy[i], quantity: copy[i].quantity + 1, subtotal: (copy[i].quantity + 1) * copy[i].price };
        return copy;
      }
      return [...c, { product_id: p.id, name: p.name, price: p.price, quantity: 1, subtotal: p.price, note: "" }];
    });
  };

  const setQty = (idx, qty) => {
    setCart((c) => {
      if (qty <= 0) return c.filter((_, i) => i !== idx);
      const copy = [...c];
      copy[idx] = { ...copy[idx], quantity: qty, subtotal: qty * copy[idx].price };
      return copy;
    });
  };

  const setItemNote = (idx, noteVal) => {
    setCart((c) => {
      const copy = [...c];
      copy[idx] = { ...copy[idx], note: noteVal };
      return copy;
    });
  };

  // Calculations
  const isDineIn = selectedTable !== null;
  const subtotal = cart.reduce((s, i) => s + i.subtotal, 0);
  const baseAmount = Math.max(0, subtotal - discount);
  
  // F&B pb1 + service calculation vs retail tax
  const serviceCharge = isDineIn ? round(baseAmount * 0.05, 2) : 0.0;
  const taxAmount = isDineIn 
    ? round((baseAmount + serviceCharge) * 0.10, 2)
    : baseAmount * (taxPercent / 100);
    
  const total = baseAmount + serviceCharge + taxAmount;
  const change = parseFloat(cashReceived || 0) - total;

  function round(num, decimals) {
    const x = Math.pow(10, decimals);
    return Math.round(num * x) / x;
  }

  const clearCart = () => {
    setCart([]);
    setCashReceived("");
    setDiscount(0);
    setSelectedCustomerId("");
  };

  // F&B checkout or Direct retail checkout
  const checkout = async () => {
    if (cart.length === 0) return;
    
    // Simulate local EDC terminal payload push for card and EDC transactions
    if (paymentMethod === "edc" || paymentMethod === "debit" || paymentMethod === "credit") {
      setEdcSimulating(true);
      setEdcTimer(3);
      return;
    }
    
    processCheckout();
  };

  const processCheckout = async (directPaid = false) => {
    setSubmitting(true);
    try {
      const payload = {
        items: cart,
        payment_method: directPaid ? "card" : paymentMethod,
        discount: parseFloat(discount) || 0,
        tax_percent: isDineIn ? 10.0 : parseFloat(taxPercent) || 0,
        cash_received: paymentMethod === "cash" && !directPaid ? parseFloat(cashReceived) : undefined,
      };

      if (isDineIn && activeSession) {
        payload.session_id = activeSession.session.id;
        payload.dining_option = "Dine-In";
      } else {
        payload.dining_option = "Takeaway";
      }

      const selCust = customers.find(c => c.id === selectedCustomerId);
      if (selCust) {
        payload.customer_name = selCust.name;
        payload.customer_phone = selCust.phone || undefined;
        payload.customer_email = selCust.email || undefined;
      }
      
      const r = await api.post("/orders", payload);
      
      // If Dine-In checkout, automatically close session & clear table
      if (isDineIn) {
        await api.post(`/tables/${selectedTable.id}/checkout`, {
          payment_method: directPaid ? "card" : paymentMethod
        });
        setSelectedTable(null);
        setActiveSession(null);
        setViewMode("floor");
        loadTables();
      }
      
      setReceipt(r.data);
      clearCart();
    } catch (e) {
      alert(e?.response?.data?.detail || "Gagal memproses transaksi");
    } finally {
      setSubmitting(false);
      setEdcSimulating(false);
    }
  };

  // EDC Simulator Countdown
  useEffect(() => {
    if (!edcSimulating) return;
    if (edcTimer === 0) {
      if (edcSplitSimulating) {
        processSplitEdc();
      } else {
        processCheckout(true); // Settle as Card payment
      }
      return;
    }
    const t = setTimeout(() => setEdcTimer(edcTimer - 1), 1000);
    return () => clearTimeout(t);
  }, [edcSimulating, edcTimer, edcSplitSimulating]);

  // Open active session
  const handleOpenTableSession = async (table) => {
    const res = await api.post(`/tables/${table.id}/session`);
    setSelectedTable(table);
    setActiveSession(res.data);
    loadActiveTableSession(table.id);
  };

  const handleSelectTable = (table) => {
    setSelectedTable(table);
    if (table.status !== "Vacant") {
      loadActiveTableSession(table.id);
    } else {
      setActiveSession(null);
    }
  };

  const handleBillSplitEqual = async () => {
    if (!activeSession) return;
    try {
      const res = await api.post(`/tables/${selectedTable.id}/split-bill`, {
        type: "equal",
        ways: parseInt(splitWays)
      });
      setSplitEqualResult(res.data);
    } catch (e) {}
  };

  const handleBillSplitItem = async () => {
    if (!activeSession) return;
    try {
      const splitItems = [];
      Object.keys(splitQuantities).forEach(pId => {
        const q = splitQuantities[pId];
        if (q > 0) {
          splitItems.append({ product_id: pId, quantity: q });
        }
      });
      
      if (splitItems.length === 0) {
        alert("Pilih item untuk dipisah");
        return;
      }
      
      const res = await api.post(`/tables/${selectedTable.id}/split-bill`, {
        type: "item",
        items: splitItems
      });
      
      setSplitOrderResult(res.data.split_order);
      setSplitOpen(false);
      
      // Load updated bill session
      loadActiveTableSession(selectedTable.id);
    } catch (e) {
      alert("Gagal membagi tagihan");
    }
  };

  const handlePaySplitOrder = async (payMethod) => {
    if (!splitOrderResult) return;
    
    if (payMethod === "edc") {
      setEdcSplitSimulating(true);
      setEdcSimulating(true);
      setEdcTimer(3);
      return;
    }
    
    processSplitPayment(payMethod);
  };

  const processSplitEdc = async () => {
    processSplitPayment("card");
  };

  const processSplitPayment = async (payMethod) => {
    setSubmitting(true);
    try {
      // Mark split order as paid
      const r = await api.post(`/orders/${splitOrderResult.id}/mark-paid`);
      setReceipt(r.data);
      setSplitOrderResult(null);
      setEdcSplitSimulating(false);
      setEdcSimulating(false);
      
      // If table session is now empty, reset table to vacant
      const bill = await api.get(`/tables/${selectedTable.id}/session`);
      if (bill.data.items.length === 0) {
        await api.post(`/tables/${selectedTable.id}/checkout`, { payment_method: payMethod });
        setSelectedTable(null);
        setActiveSession(null);
        setViewMode("floor");
        loadTables();
      }
    } catch (e) {
      alert("Gagal memproses pembayaran");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]" data-testid="pos-page">
      {viewMode === "floor" ? (
        // FLOOR LAYOUT VIEW
        <div className="p-6 grid grid-cols-12 gap-6 text-left">
          <div className="col-span-12 lg:col-span-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-display text-2xl font-bold flex items-center gap-2">
                  <Store className="text-[hsl(var(--primary))]" /> Layout Meja & FOH
                </h1>
                <p className="text-xs text-[hsl(var(--muted))] mt-1">
                  Pilih meja untuk mengatur tagihan dining, pesanan kustom, atau check-out.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenAddTable}
                  className="btn-primary text-xs py-2 px-3 flex items-center gap-1 bg-amber-600 hover:bg-amber-700 border-amber-600 font-bold"
                  data-testid="pos-add-table-btn"
                >
                  <Plus size={14} /> Meja Baru
                </button>
                <span className={`text-[10px] uppercase font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${websocketConnected ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                  {websocketConnected ? (
                    <><Wifi size={12} /> WebSocket Aktif</>
                  ) : (
                    <><WifiOff size={12} /> HTTP Polling</>
                  )}
                </span>
                <button
                  onClick={() => { setSelectedTable(null); setViewMode("catalog"); clearCart(); }}
                  className="btn-outline text-xs py-2 px-4 flex items-center gap-1.5"
                >
                  Langsung Takeaway <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Floor Tabs */}
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-3">
              <div className="flex gap-2 overflow-x-auto">
                {floors.map(fl => (
                  <button
                    key={fl.id}
                    onClick={() => setSelectedFloorId(fl.id)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${selectedFloorId === fl.id ? "bg-[hsl(var(--primary))] text-white" : "bg-[hsl(var(--surface))] border border-[hsl(var(--border))] text-[hsl(var(--muted))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]"}`}
                  >
                    {fl.name}
                  </button>
                ))}
              </div>
              <button
                onClick={handleOpenAddFloor}
                className="text-xs text-[hsl(var(--primary))] hover:underline font-bold flex items-center gap-1 shrink-0 ml-2"
                data-testid="pos-add-floor-btn"
              >
                <Plus size={13} /> Tambah Lantai
              </button>
            </div>

            {/* Visual Floor Map Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 p-6 bg-[hsl(var(--surface))]/40 border border-[hsl(var(--border))] rounded-2xl min-h-[380px]">
              {tables.filter(t => t.floor_id === selectedFloorId).map(t => {
                const isSelected = selectedTable?.id === t.id;
                let statusBg = "bg-slate-50 border-slate-200 hover:border-slate-400";
                let statusText = "Kosong (Vacant)";
                let dotColor = "bg-slate-400";
                
                if (t.status === "Seated") {
                  statusBg = "bg-yellow-50 border-yellow-200 hover:border-yellow-400 text-yellow-900";
                  statusText = "Tamu Duduk";
                  dotColor = "bg-yellow-500";
                } else if (t.status === "Dining") {
                  statusBg = "bg-red-50 border-red-200 hover:border-red-400 text-red-900";
                  statusText = "Dining / Aktif";
                  dotColor = "bg-red-500 animate-pulse";
                } else if (t.status === "Billing") {
                  statusBg = "bg-blue-50 border-blue-200 hover:border-blue-400 text-blue-900";
                  statusText = "Minta Tagihan";
                  dotColor = "bg-blue-500 animate-bounce";
                }

                return (
                  <div
                    key={t.id}
                    onClick={() => handleSelectTable(t)}
                    className={`p-4 rounded-xl border flex flex-col items-center justify-between text-center transition-all cursor-pointer relative group ${statusBg} ${isSelected ? "ring-2 ring-[hsl(var(--primary))] scale-[1.03]" : ""}`}
                  >
                    <div className="flex items-center justify-between w-full text-[10px] text-[hsl(var(--muted))]">
                      <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                      <span>{t.capacity} Pax</span>
                    </div>
                    <span className="font-display font-black text-base text-[hsl(var(--foreground))] mt-2">{t.label}</span>
                    <span className="text-[10px] font-semibold mt-1 opacity-70">{statusText}</span>
                    
                    <div className="absolute top-2 right-2 hidden group-hover:flex items-center gap-1 bg-white/90 p-1 rounded-md shadow border border-slate-200">
                      <button onClick={(e) => handleOpenEditTable(t, e)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Edit Meja"><Edit3 size={12} /></button>
                      <button onClick={(e) => handleDeleteTable(t.id, e)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Hapus Meja"><Trash2 size={12} /></button>
                    </div>
                  </div>
                );
              })}
              {tables.filter(t => t.floor_id === selectedFloorId).length === 0 && (
                <div className="col-span-full py-12 text-center text-xs text-[hsl(var(--muted))] space-y-2">
                  <p>Belum ada meja dikonfigurasi di lantai ini.</p>
                  <button onClick={handleOpenAddTable} className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1"><Plus size={12} /> Tambah Meja Sekarang</button>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Table Details */}
          <aside className="col-span-12 lg:col-span-4 bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-2xl p-5 flex flex-col justify-between min-h-[500px]">
            {selectedTable ? (
              <div className="space-y-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-3 mb-4">
                    <div>
                      <h3 className="font-display font-black text-lg">{selectedTable.label}</h3>
                      <span className="text-[10px] text-[hsl(var(--muted))] uppercase font-bold">
                        Floor: {floors.find(f => f.id === selectedTable.floor_id)?.name}
                      </span>
                    </div>
                    <span className={`pill text-[10px] px-2 py-0.5 ${selectedTable.status === "Vacant" ? "pill-muted" : selectedTable.status === "Seated" ? "pill-warning" : "pill-danger"}`}>
                      {selectedTable.status}
                    </span>
                  </div>

                  <div className="space-y-4">
                    <span className="text-[10px] uppercase font-bold text-[hsl(var(--muted))] tracking-wider">Daftar Tagihan Sesi:</span>
                    {activeSession && Array.isArray(activeSession.items) && activeSession.items.length > 0 ? (
                      <div className="divide-y divide-[hsl(var(--border))] max-h-[220px] overflow-y-auto pr-1">
                        {activeSession.items.map((it, idx) => (
                          <div key={idx} className="py-2.5 flex justify-between items-start text-xs">
                            <div>
                              <p className="font-bold text-[hsl(var(--foreground))]">{it.qty}x {it.name}</p>
                              {it.notes && <p className="text-[10px] text-amber-600 italic">"{it.notes}"</p>}
                            </div>
                            <span className="font-mono font-bold text-slate-800">{fmtIDR((it.price || 0) * (it.qty || 1))}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-10 text-center border border-dashed border-[hsl(var(--border))] rounded-xl text-xs text-[hsl(var(--muted))]">
                        {selectedTable.status === "Vacant" 
                          ? "Meja masih kosong. Buka meja untuk mulai memesan."
                          : "Belum ada menu dipesan. Ketuk 'Ambil Pesanan' untuk mengisi."}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4 border-t border-[hsl(var(--border))] pt-4">
                  {activeSession && Array.isArray(activeSession.items) && activeSession.items.length > 0 && (
                    <div className="space-y-1.5 text-xs text-[hsl(var(--muted))]">
                      <div className="flex justify-between"><span>Subtotal</span><span className="num-display font-bold">{fmtIDR(activeSession.subtotal || 0)}</span></div>
                      <div className="flex justify-between"><span>Service Charge (5%)</span><span className="num-display font-bold">{fmtIDR(activeSession.service_charge || 0)}</span></div>
                      <div className="flex justify-between"><span>Restoran Tax PB1 (10%)</span><span className="num-display font-bold">{fmtIDR(activeSession.tax_pb1 || 0)}</span></div>
                      <div className="flex justify-between text-sm text-[hsl(var(--foreground))] font-black border-t border-[hsl(var(--border))]/50 pt-2 mt-1">
                        <span>Total Tagihan</span>
                        <span className="text-[hsl(var(--primary))] num-display">{fmtIDR(activeSession.grand_total || 0)}</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {selectedTable.status === "Vacant" ? (
                      <button
                        onClick={() => handleOpenTableSession(selectedTable)}
                        className="btn-primary col-span-2 py-3 text-xs"
                      >
                        Buka Meja / Tempatkan Tamu
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            // Populate cart with existing active items to allow edits/additions
                            setCart([]);
                            setViewMode("catalog");
                          }}
                          className="btn-outline py-2.5 text-xs font-bold"
                        >
                          Ambil Pesanan
                        </button>
                        
                        {activeSession && Array.isArray(activeSession.items) && activeSession.items.length > 0 ? (
                          <button
                            onClick={() => {
                              // Settle checkout flow
                              // Map active session items to cart format
                              const mapped = (activeSession.items || []).map(it => ({
                                product_id: it.product_id || it.menu_item_id,
                                name: it.name,
                                price: it.price,
                                quantity: it.qty,
                                subtotal: (it.price || 0) * (it.qty || 1),
                                note: it.notes
                              }));
                              setCart(mapped);
                              setViewMode("catalog");
                            }}
                            className="btn-primary py-2.5 text-xs font-bold"
                          >
                            Checkout Settle
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              // Reset vacant
                              await api.put(`/tables/${selectedTable.id}`, { status: "Vacant" });
                              setSelectedTable(null);
                              loadTables();
                            }}
                            className="btn-ghost text-red-650 hover:bg-red-50 py-2.5 text-xs font-bold border border-red-200"
                          >
                            Kosongkan Meja
                          </button>
                        )}
                        
                        {activeSession && Array.isArray(activeSession.items) && activeSession.items.length > 0 && (
                          <button
                            onClick={() => {
                              setSplitWays(2);
                              setSplitEqualResult(null);
                              setSplitQuantities(
                                (activeSession.items || []).reduce((acc, it) => {
                                  acc[it.product_id] = 0;
                                  return acc;
                                }, {})
                              );
                              setSplitOpen(true);
                            }}
                            className="btn-outline col-span-2 py-2 text-xs font-bold text-amber-700 border-amber-200 hover:bg-amber-50"
                          >
                            Split Bill (Bagi Tagihan)
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-[hsl(var(--muted))] space-y-3 py-16">
                <Store size={48} className="stroke-[1.2] text-[hsl(var(--muted))]/50" />
                <div>
                  <h4 className="font-bold text-sm text-[hsl(var(--foreground))]">Pilih Meja Layout</h4>
                  <p className="text-[11px] max-w-[220px] mx-auto mt-1 leading-relaxed">
                    Silakan ketuk salah satu meja di denah sebelah kiri untuk mengelola sesi pesanan dining.
                  </p>
                </div>
              </div>
            )}
          </aside>
        </div>
      ) : (
        // PRODUCT CATALOG & CHECKOUT CART VIEW
        <div className="grid grid-cols-12 h-screen relative">
          {/* Left: Product Grid */}
          <div className="col-span-12 lg:col-span-8 p-6 overflow-y-auto text-left">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setViewMode("floor"); clearCart(); }}
                  className="p-2 border border-[hsl(var(--border))] rounded-lg hover:bg-[hsl(var(--secondary))]"
                >
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <span className="label-tiny">
                    {isDineIn ? `Dining Session: ${selectedTable.label}` : "Takeaway POS"}
                  </span>
                  <h1 className="font-display text-2xl font-bold mt-0.5">Katalog Resep / Menu</h1>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleOpenAddProduct}
                  className="btn-primary text-xs py-2 px-3 flex items-center gap-1 font-bold"
                  data-testid="pos-add-product-btn"
                >
                  <Plus size={14} /> Menu Baru
                </button>
                <div className="relative w-56">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted))]" />
                  <input className="input-field pl-9" placeholder="Cari menu resep…"
                         value={q} onChange={(e) => setQ(e.target.value)} data-testid="pos-search" />
                </div>
                <form onSubmit={handleManualBarcodeScan} className="relative w-44 flex items-center">
                  <Barcode size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted))]" />
                  <input className="input-field pl-9 pr-14" placeholder="SKU/Barcode…"
                         value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} data-testid="pos-barcode-input" />
                  <button type="submit" className="absolute right-1 px-2 py-1 bg-[hsl(var(--primary))] text-white rounded text-xs font-semibold hover:bg-[hsl(var(--primary))]/80">
                    Scan
                  </button>
                </form>
              </div>
            </div>

            <div className="flex gap-2 mb-4 overflow-x-auto" data-testid="pos-categories">
              <button onClick={() => setActiveCat("all")}
                      className={`px-4 py-1.5 rounded-md text-sm font-medium whitespace-nowrap ${activeCat === "all" ? "bg-[hsl(var(--primary))] text-white" : "bg-[hsl(var(--surface))] border border-[hsl(var(--border))]"}`}
                      data-testid="cat-all">Semua</button>
              {categories.map((c) => (
                <button key={c} onClick={() => setActiveCat(c)}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium whitespace-nowrap ${activeCat === c ? "bg-[hsl(var(--primary))] text-white" : "bg-[hsl(var(--surface))] border border-[hsl(var(--border))]"}`}
                        data-testid={`cat-${c}`}>{c}</button>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3" data-testid="pos-product-grid">
              {filtered.map((p) => (
                <div key={p.id} onClick={() => addToCart(p)}
                        className="card-surface p-3 text-left hover:border-[hsl(var(--primary))] hover:shadow-sm transition-all flex flex-col justify-between cursor-pointer relative group"
                        data-testid={`pos-product-${p.id}`}>
                  <div>
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-32 object-cover rounded-md mb-2 bg-[hsl(var(--secondary))]" />
                    ) : (
                      <div className="w-full h-32 bg-[hsl(var(--secondary))] flex flex-col items-center justify-center rounded-md mb-2 text-[hsl(var(--muted))] text-xs font-semibold gap-1">
                        <Barcode size={24} className="stroke-[1.5]" />
                        <span>Tanpa Gambar</span>
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-2 mt-1">
                      <span className="pill pill-muted text-[9px] px-1 py-0.5">{p.category}</span>
                      {p.recipe && p.recipe.length > 0 ? (
                        <span className="pill pill-warning text-[9px] px-1 py-0.5">Resep (BOM)</span>
                      ) : (
                        <span className="text-[10px] text-[hsl(var(--muted))]">Stok {p.stock}</span>
                      )}
                    </div>
                    <p className="font-display font-bold mt-1.5 text-sm leading-snug line-clamp-2">{p.name}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                    <p className="num-display font-display text-base font-bold text-[hsl(var(--primary))]">{fmtIDR(p.price)}</p>
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => handleOpenEditProduct(p, e)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Edit Menu"><Edit3 size={13} /></button>
                      <button onClick={(e) => handleDeleteProduct(p.id, e)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Hapus Menu"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && <p className="col-span-full text-center text-[hsl(var(--muted))] py-10" data-testid="pos-no-products">Tidak ada menu resep.</p>}
            </div>
          </div>

          {/* Right Panel: Cart */}
          <aside className="col-span-12 lg:col-span-4 border-l border-[hsl(var(--border))] bg-[hsl(var(--surface))] flex flex-col" data-testid="pos-cart">
            <div className="p-5 border-b border-[hsl(var(--border))] flex items-center justify-between text-left">
              <div>
                <h2 className="font-display text-lg font-bold">Keranjang ({cart.length})</h2>
                {isDineIn && <span className="text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full inline-block mt-1">Meja: {selectedTable.label}</span>}
              </div>
              {cart.length > 0 && (
                <button onClick={clearCart} className="btn-ghost text-xs text-[hsl(var(--destructive))]" data-testid="pos-clear-cart">
                  <Trash2 size={13} /> Bersihkan
                </button>
              )}
            </div>

            {/* Customer dropdown selector */}
            <div className="px-4 pt-3 pb-2 border-b border-[hsl(var(--border))] text-left" data-testid="pos-customer-selector">
              <label className="label-tiny mb-1 block">Pelanggan</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="input-field py-1.5 text-sm w-full"
                data-testid="pos-customer-dropdown"
              >
                <option value="">— Tanpa Pelanggan —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ""}</option>
                ))}
              </select>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-3 text-left">
              {cart.length === 0 && (
                <p className="text-sm text-center text-[hsl(var(--muted))] py-12" data-testid="cart-empty">
                  Keranjang kosong. Klik menu resep di sebelah kiri.
                </p>
              )}
              {cart.map((it, idx) => (
                <div key={it.product_id} className="card-surface p-3 mb-2" data-testid={`cart-item-${idx}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-medium text-sm leading-tight">{it.name}</p>
                    <p className="font-display font-bold num-display text-sm">{fmtIDR(it.subtotal)}</p>
                  </div>
                  
                  {/* Notes Input per-item for food modifications */}
                  <div className="mb-2">
                    <input
                      type="text"
                      placeholder="Modifikasi (cth: Less Ice, Pedas...)"
                      value={it.note || ""}
                      onChange={(e) => setItemNote(idx, e.target.value)}
                      className="w-full text-[10px] bg-slate-50 border border-slate-200 rounded px-2 py-0.5 placeholder-slate-400 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[hsl(var(--muted))]">{fmtIDR(it.price)} ea</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setQty(idx, it.quantity - 1)} className="w-7 h-7 rounded-md border border-[hsl(var(--border))] grid place-items-center" data-testid={`cart-dec-${idx}`}><Minus size={12} /></button>
                      <span className="num-display font-semibold text-sm w-6 text-center" data-testid={`cart-qty-${idx}`}>{it.quantity}</span>
                      <button onClick={() => setQty(idx, it.quantity + 1)} className="w-7 h-7 rounded-md border border-[hsl(var(--border))] grid place-items-center" data-testid={`cart-inc-${idx}`}><Plus size={12} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Calculations & Payment Checkout */}
            <div className="border-t border-[hsl(var(--border))] p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs text-left">
                <div>
                  <label className="label-tiny">Diskon (Rp)</label>
                  <input className="input-field mt-1 py-2 text-sm" type="number" value={discount}
                         onChange={(e) => setDiscount(e.target.value)} data-testid="cart-discount" />
                </div>
                {!isDineIn && (
                  <div>
                    <label className="label-tiny">PPN (%)</label>
                    <input className="input-field mt-1 py-2 text-sm" type="number" value={taxPercent}
                           onChange={(e) => setTaxPercent(e.target.value)} data-testid="cart-tax" />
                  </div>
                )}
              </div>

              <div className="space-y-1 text-sm pt-1 text-left">
                <div className="flex justify-between"><span className="text-[hsl(var(--muted))]">Subtotal</span><span className="num-display">{fmtIDR(subtotal)}</span></div>
                {discount > 0 && <div className="flex justify-between"><span className="text-[hsl(var(--muted))]">Diskon</span><span className="num-display">-{fmtIDR(discount)}</span></div>}
                
                {/* Cart summary breakdown with explicit Service Charge row */}
                <div className="flex justify-between" data-testid="cart-service-charge-line"><span className="text-[hsl(var(--muted))]">Biaya Layanan / Service Charge (5%)</span><span className="num-display" data-testid="cart-service-charge">{fmtIDR(serviceCharge)}</span></div>
                {taxAmount > 0 && <div className="flex justify-between"><span className="text-[hsl(var(--muted))]">Pajak (PB1 / PPN)</span><span className="num-display">{fmtIDR(taxAmount)}</span></div>}
                
                <div className="flex justify-between font-display text-xl font-extrabold text-[hsl(var(--primary))] pt-1">
                  <span>TOTAL</span><span className="num-display" data-testid="cart-total">{fmtIDR(total)}</span>
                </div>
              </div>

              <div className="text-left">
                <label className="label-tiny mb-2 block">Metode Pembayaran</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
                  <button onClick={() => setPaymentMethod("cash")}
                          className={`p-2 rounded-md text-[10px] font-semibold border transition-colors ${paymentMethod === "cash" ? "bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]" : "border-[hsl(var(--border))] bg-[hsl(var(--surface))]"}`}
                          data-testid="pm-cash"><Banknote size={12} className="mx-auto mb-1" />Tunai</button>
                  <button onClick={() => setPaymentMethod("qris")}
                          className={`p-2 rounded-md text-[10px] font-semibold border transition-colors ${paymentMethod === "qris" ? "bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]" : "border-[hsl(var(--border))] bg-[hsl(var(--surface))]"}`}
                          data-testid="pm-qris"><QrCode size={12} className="mx-auto mb-1" />QRIS</button>
                  <button onClick={() => setPaymentMethod("ewallet")}
                          className={`p-2 rounded-md text-[10px] font-semibold border transition-colors ${paymentMethod === "ewallet" ? "bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]" : "border-[hsl(var(--border))] bg-[hsl(var(--surface))]"}`}
                          data-testid="pm-ewallet"><Smartphone size={12} className="mx-auto mb-1" />E-Wallet</button>
                  <button onClick={() => setPaymentMethod("debit")}
                          className={`p-2 rounded-md text-[10px] font-semibold border transition-colors ${paymentMethod === "debit" ? "bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]" : "border-[hsl(var(--border))] bg-[hsl(var(--surface))]"}`}
                          data-testid="pm-debit"><CreditCard size={12} className="mx-auto mb-1" />Kartu Debit</button>
                  <button onClick={() => setPaymentMethod("credit")}
                          className={`p-2 rounded-md text-[10px] font-semibold border transition-colors ${paymentMethod === "credit" ? "bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]" : "border-[hsl(var(--border))] bg-[hsl(var(--surface))]"}`}
                          data-testid="pm-credit"><CreditCard size={12} className="mx-auto mb-1 text-amber-500" />Kartu Kredit</button>
                  <button onClick={() => setPaymentMethod("edc")}
                          className={`p-2 rounded-md text-[10px] font-semibold border transition-colors ${paymentMethod === "edc" ? "bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]" : "border-[hsl(var(--border))] bg-[hsl(var(--surface))]"}`}
                          data-testid="pm-edc"><CreditCard size={12} className="mx-auto mb-1" />EDC EDC</button>
                </div>
              </div>

              {paymentMethod === "cash" && (
                <div data-testid="pm-cash-details" className="text-left">
                  <label className="label-tiny">Diterima Tunai (Rp)</label>
                  <input className="input-field mt-1 py-2 text-sm" type="number" value={cashReceived}
                         onChange={(e) => setCashReceived(e.target.value)} placeholder={total.toFixed(0)} data-testid="cart-cash-received" />
                  {cashReceived && (
                    <p className={`text-xs mt-1 ${change >= 0 ? "text-[hsl(var(--success))]" : "text-[hsl(var(--destructive))]"}`} data-testid="cart-change">
                      {change >= 0 ? `Kembalian: ${fmtIDR(change)}` : `Kurang: ${fmtIDR(-change)}`}
                    </p>
                  )}
                </div>
              )}

              {paymentMethod === "ewallet" && (
                <div data-testid="pm-ewallet-details" className="text-left">
                  <label className="label-tiny">Pilih E-Wallet</label>
                  <div className="grid grid-cols-2 gap-1.5 mt-1">
                    {EWALLET_CHANNELS.map((c) => (
                      <button key={c.code} onClick={() => setEwallet(c.code)}
                              className={`p-2 rounded-md text-xs font-semibold border ${ewallet === c.code ? "bg-[hsl(var(--accent))] text-white border-[hsl(var(--accent))]" : "border-[hsl(var(--border))]"}`}
                              data-testid={`ew-${c.code}`}>{c.label}</button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={checkout}
                disabled={submitting || cart.length === 0 || (paymentMethod === "cash" && (parseFloat(cashReceived || 0) < total))}
                className="btn-primary w-full py-3"
                data-testid="checkout-btn"
              >
                {submitting ? "Memproses…" : `Bayar ${fmtIDR(total)}`}
              </button>
            </div>
          </aside>
        </div>
      )}

      {receipt && <ReceiptDialog order={receipt} onClose={() => setReceipt(null)} />}

      {/* Visual EDC Payment Simulator Modal */}
      {edcSimulating && (
        <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4">
          <div className="card-surface bg-slate-900 border border-slate-800 text-white w-full max-w-sm p-6 text-center space-y-4">
            <CreditCard size={48} className="mx-auto text-amber-500 animate-pulse" />
            <h2 className="font-display text-lg font-bold">Simulasi Integrasi EDC</h2>
            <p className="text-xs text-slate-400">
              Mengirimkan nominal pembayaran <span className="font-bold text-white font-mono">{fmtIDR(splitOrderResult ? splitOrderResult.total : total)}</span> ke terminal EDC local card reader...
            </p>
            <div className="py-2">
              <span className="text-2xl font-mono font-black">{edcTimer}s</span>
            </div>
            <p className="text-[10px] text-slate-500">
              Mohon dekatkan atau gesek kartu debit/kredit pelanggan pada terminal EDC untuk simulasi checkout.
            </p>
            <button
              onClick={() => setEdcSimulating(false)}
              className="btn-outline border-slate-700 text-slate-300 w-full text-xs py-2"
            >
              Batal Pembayaran
            </button>
          </div>
        </div>
      )}

      {/* Bill Splitting Dialog Modal */}
      {splitOpen && activeSession && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={() => setSplitOpen(false)}>
          <div className="card-surface bg-white p-6 w-full max-w-lg space-y-5 text-left" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-3">
              <div>
                <h2 className="font-display text-lg font-bold">Opsi Bagi Tagihan (Split Bill)</h2>
                <span className="text-[10px] text-[hsl(var(--muted))]">Meja: {selectedTable.label} · Total: {fmtIDR(activeSession.grand_total)}</span>
              </div>
              <button onClick={() => setSplitOpen(false)} className="btn-ghost p-1"><X size={18} /></button>
            </div>

            <div className="flex gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => setSplitType("equal")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${splitType === "equal" ? "bg-white text-[hsl(var(--foreground))] shadow" : "text-[hsl(var(--muted))]"}`}
              >
                Bagi Rata (Equal Split)
              </button>
              <button
                onClick={() => setSplitType("item")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${splitType === "item" ? "bg-white text-[hsl(var(--foreground))] shadow" : "text-[hsl(var(--muted))]"}`}
              >
                Bagi Per Item
              </button>
            </div>

            {splitType === "equal" ? (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="label-tiny">Jumlah Pembagian (Orang)</label>
                  <input
                    type="number"
                    min="2"
                    max="20"
                    value={splitWays}
                    onChange={(e) => setSplitWays(e.target.value)}
                    className="input-field mt-1 py-2 text-sm"
                  />
                </div>
                <button onClick={handleBillSplitEqual} className="btn-primary w-full py-2.5 text-xs">Hitung Pembagian</button>
                
                {splitEqualResult && (
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-900 flex justify-between items-center">
                    <span className="font-semibold">Per Orang ({splitEqualResult.ways} cara):</span>
                    <span className="text-base font-display font-black num-display">{fmtIDR(splitEqualResult.amount_per_person)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <p className="text-[10px] text-[hsl(var(--muted))]">Pilih jumlah kuantitas item yang ingin dipisahkan ke bill baru:</p>
                <div className="divide-y divide-slate-100 max-h-[220px] overflow-y-auto pr-1">
                  {activeSession.items.map((it, idx) => (
                    <div key={idx} className="py-2 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-slate-800">{it.name}</p>
                        <p className="text-[10px] text-slate-400">Total di keranjang: {it.qty} unit</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSplitQuantities({
                            ...splitQuantities,
                            [it.product_id]: Math.max(0, (splitQuantities[it.product_id] || 0) - 1)
                          })}
                          className="w-6 h-6 border rounded grid place-items-center"
                        >
                          -
                        </button>
                        <span className="w-6 text-center font-bold">{splitQuantities[it.product_id] || 0}</span>
                        <button
                          onClick={() => setSplitQuantities({
                            ...splitQuantities,
                            [it.product_id]: Math.min(it.qty, (splitQuantities[it.product_id] || 0) + 1)
                          })}
                          className="w-6 h-6 border rounded grid place-items-center"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={handleBillSplitItem} className="btn-primary w-full py-2.5 text-xs">Pisahkan ke Bill Baru</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Split Order Checkout Screen (Shows after splitting items) */}
      {splitOrderResult && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4">
          <div className="card-surface bg-white w-full max-w-md p-6 space-y-4 text-left">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="label-tiny">Tagihan Terpisah</span>
                <p className="font-display text-lg font-bold">{splitOrderResult.order_no}</p>
              </div>
              <button onClick={() => setSplitOrderResult(null)} className="btn-ghost p-1"><X size={18} /></button>
            </div>

            <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
              {splitOrderResult.items.map((it, idx) => (
                <div key={idx} className="py-2 flex justify-between text-xs">
                  <span>{it.quantity}x {it.name}</span>
                  <span className="font-bold">{fmtIDR(it.subtotal)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1 text-xs pt-3 border-t border-slate-100">
              <div className="flex justify-between"><span>Subtotal</span><span>{fmtIDR(splitOrderResult.subtotal)}</span></div>
              <div className="flex justify-between"><span>Service Charge</span><span>{fmtIDR(splitOrderResult.service_charge)}</span></div>
              <div className="flex justify-between"><span>PB1 Tax</span><span>{fmtIDR(splitOrderResult.tax_pb1)}</span></div>
              <div className="flex justify-between text-sm font-bold text-[hsl(var(--primary))] pt-1 border-t mt-1">
                <span>TOTAL split bill:</span>
                <span className="num-display">{fmtIDR(splitOrderResult.total)}</span>
              </div>
            </div>

            <div>
              <label className="label-tiny mb-1 block">Pilih Pembayaran Split</label>
              <div className="grid grid-cols-3 gap-1">
                <button onClick={() => handlePaySplitOrder("cash")} className="btn-outline py-2 text-[10px] font-bold">Tunai</button>
                <button onClick={() => handlePaySplitOrder("qris")} className="btn-outline py-2 text-[10px] font-bold">QRIS</button>
                <button onClick={() => handlePaySplitOrder("edc")} className="btn-outline py-2 text-[10px] font-bold">EDC</button>
              </div>
            </div>

            <button onClick={() => setSplitOrderResult(null)} className="btn-ghost text-slate-500 w-full text-xs">Batal & Settle Nanti</button>
          </div>
        </div>
      )}

      {scannedProduct && (
        <div className="fixed bottom-6 left-72 z-[100] animate-bounce bg-white border-2 border-[hsl(var(--success))] p-4 rounded-xl shadow-2xl flex items-center gap-4 max-w-sm" data-testid="scanned-overlay">
          <div className="w-16 h-16 bg-[hsl(var(--secondary))] flex flex-col items-center justify-center rounded-md border border-[hsl(var(--border))] text-[hsl(var(--muted))]">
            <Barcode size={24} className="stroke-[1.5]" />
          </div>
          <div className="flex-1">
            <span className="pill pill-success text-[9px] px-1.5 py-0.5 inline-block font-semibold">Barcode Discan</span>
            <p className="font-bold text-sm leading-tight mt-1 text-[hsl(var(--foreground))]">{scannedProduct.name}</p>
            <p className="font-display font-extrabold text-[hsl(var(--primary))] text-sm mt-1">{fmtIDR(scannedProduct.price)}</p>
          </div>
        </div>
      )}

      {/* Table CRUD Modal */}
      {tableModalOpen && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={() => setTableModalOpen(false)}>
          <form onSubmit={handleSaveTable} className="card-surface bg-white p-6 w-full max-w-md space-y-4 text-left" onClick={(e) => e.stopPropagation()} data-testid="table-form-modal">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="font-display font-bold text-lg">{editingTable ? "Edit Meja" : "Tambah Meja Baru"}</h2>
              <button type="button" onClick={() => setTableModalOpen(false)} className="btn-ghost p-1"><X size={18} /></button>
            </div>
            <div>
              <label className="label-tiny block mb-1">Nama / Label Meja</label>
              <input
                type="text"
                required
                value={tableForm.label}
                onChange={(e) => setTableForm({ ...tableForm, label: e.target.value })}
                placeholder="Contoh: Meja 07, VIP Sofa A"
                className="input-field"
                data-testid="table-label-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-tiny block mb-1">Kapasitas (Pax)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  required
                  value={tableForm.capacity}
                  onChange={(e) => setTableForm({ ...tableForm, capacity: e.target.value })}
                  className="input-field"
                  data-testid="table-capacity-input"
                />
              </div>
              <div>
                <label className="label-tiny block mb-1">Pilih Lantai</label>
                <select
                  value={tableForm.floor_id}
                  onChange={(e) => setTableForm({ ...tableForm, floor_id: e.target.value })}
                  className="input-field py-2"
                  data-testid="table-floor-select"
                >
                  {floors.map(fl => (
                    <option key={fl.id} value={fl.id}>{fl.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <button type="button" onClick={() => setTableModalOpen(false)} className="btn-outline text-xs px-4 py-2">Batal</button>
              <button type="submit" className="btn-primary text-xs px-5 py-2">{editingTable ? "Simpan Perubahan" : "Tambah Meja"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Floor CRUD Modal */}
      {floorModalOpen && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={() => setFloorModalOpen(false)}>
          <form onSubmit={handleSaveFloor} className="card-surface bg-white p-6 w-full max-w-md space-y-4 text-left" onClick={(e) => e.stopPropagation()} data-testid="floor-form-modal">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="font-display font-bold text-lg">Tambah Lantai Outlet</h2>
              <button type="button" onClick={() => setFloorModalOpen(false)} className="btn-ghost p-1"><X size={18} /></button>
            </div>
            <div>
              <label className="label-tiny block mb-1">Nama Lantai / Area</label>
              <input
                type="text"
                required
                value={floorForm.name}
                onChange={(e) => setFloorForm({ ...floorForm, name: e.target.value })}
                placeholder="Contoh: Lantai 3, Outdoor Terrace"
                className="input-field"
                data-testid="floor-name-input"
              />
            </div>
            <div>
              <label className="label-tiny block mb-1">Tingkat / Level</label>
              <input
                type="number"
                min="1"
                required
                value={floorForm.level}
                onChange={(e) => setFloorForm({ ...floorForm, level: e.target.value })}
                className="input-field"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <button type="button" onClick={() => setFloorModalOpen(false)} className="btn-outline text-xs px-4 py-2">Batal</button>
              <button type="submit" className="btn-primary text-xs px-5 py-2">Tambah Lantai</button>
            </div>
          </form>
        </div>
      )}

      {/* Product CRUD Modal */}
      {productModalOpen && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4" onClick={() => setProductModalOpen(false)}>
          <form onSubmit={handleSaveProduct} className="card-surface bg-white p-6 w-full max-w-md space-y-4 text-left" onClick={(e) => e.stopPropagation()} data-testid="product-form-modal">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="font-display font-bold text-lg">{editingProduct ? "Edit Menu Resep" : "Tambah Menu Baru"}</h2>
              <button type="button" onClick={() => setProductModalOpen(false)} className="btn-ghost p-1"><X size={18} /></button>
            </div>
            <div>
              <label className="label-tiny block mb-1">Nama Menu / Produk</label>
              <input
                type="text"
                required
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                placeholder="Contoh: Es Kopi Susu Aren"
                className="input-field"
                data-testid="product-name-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-tiny block mb-1">Harga Jual (Rp)</label>
                <input
                  type="number"
                  required
                  value={productForm.price}
                  onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                  className="input-field"
                  data-testid="product-price-input"
                />
              </div>
              <div>
                <label className="label-tiny block mb-1">Kategori</label>
                <select
                  value={productForm.category}
                  onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                  className="input-field py-2"
                >
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label-tiny block mb-1">Stok Porsi</label>
              <input
                type="number"
                value={productForm.stock}
                onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                className="input-field"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <button type="button" onClick={() => setProductModalOpen(false)} className="btn-outline text-xs px-4 py-2">Batal</button>
              <button type="submit" className="btn-primary text-xs px-5 py-2">{editingProduct ? "Simpan Perubahan" : "Simpan Menu"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
