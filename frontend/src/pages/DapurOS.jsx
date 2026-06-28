import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import {
  Utensils, Store, Clock, User, ChefHat, Wine, CheckCircle2, Printer,
  QrCode, Tablet, Database, Plus, Trash2, AlertTriangle, CreditCard,
  ArrowRight, ChevronDown, ChevronUp, Coffee, Beef, Check, Package,
  LineChart, Percent, DollarSign, Layers, HelpCircle, Users, Wifi
} from "lucide-react";

export default function DapurOS() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("floor"); // floor, kds, qr, inventory
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("dagangos_token") || localStorage.getItem("geraina_token") || localStorage.getItem("dapuros_token");
    if (user || token) {
      window.location.replace("/dapuros/app/dashboard");
    }
  }, [user]);

  // --- MOCK DATABASE STATE (Shared across simulator tabs) ---
  const [floors, setFloors] = useState([
    { id: "f1", name: "Lantai 1 (Utama)" },
    { id: "f2", name: "Lantai 2 (VIP)" },
    { id: "f3", name: "Rooftop (Outdoor)" }
  ]);
  const [selectedFloor, setSelectedFloor] = useState("f1");

  const [tables, setTables] = useState([
    { id: "t1", floorId: "f1", label: "Meja 01", capacity: 2, status: "Vacant", x: 10, y: 15, w: 20, h: 20, shape: "circle" },
    { id: "t2", floorId: "f1", label: "Meja 02", capacity: 4, status: "Dining", x: 40, y: 15, w: 24, h: 20, shape: "rectangle" },
    { id: "t3", floorId: "f1", label: "Meja 03", capacity: 4, status: "Billing", x: 70, y: 15, w: 24, h: 20, shape: "rectangle" },
    { id: "t4", floorId: "f1", label: "Meja 04", capacity: 2, status: "Vacant", x: 10, y: 55, w: 20, h: 20, shape: "circle" },
    { id: "t5", floorId: "f1", label: "Meja 05", capacity: 6, status: "Vacant", x: 40, y: 50, w: 28, h: 24, shape: "rectangle" },
    
    { id: "t201", floorId: "f2", label: "VIP Sofa A", capacity: 8, status: "Vacant", x: 15, y: 30, w: 32, h: 24, shape: "rectangle" },
    { id: "t202", floorId: "f2", label: "VIP Sofa B", capacity: 8, status: "Dining", x: 60, y: 30, w: 32, h: 24, shape: "rectangle" },
    
    { id: "t301", floorId: "f3", label: "Outdoor 01", capacity: 2, status: "Vacant", x: 10, y: 20, w: 20, h: 20, shape: "circle" },
    { id: "t302", floorId: "f3", label: "Outdoor 02", capacity: 4, status: "Vacant", x: 40, y: 20, w: 20, h: 20, shape: "circle" },
    { id: "t303", floorId: "f3", label: "Outdoor 03", capacity: 2, status: "Vacant", x: 70, y: 20, w: 20, h: 20, shape: "circle" },
  ]);

  const [ingredients, setIngredients] = useState([
    { id: "i1", name: "Biji Kopi Arabika", stock: 1500, unit: "g", safety: 500 },
    { id: "i2", name: "Fresh Milk", stock: 8000, unit: "ml", safety: 2000 },
    { id: "i3", name: "Saus Pizza Homemade", stock: 2500, unit: "g", safety: 1000 },
    { id: "i4", name: "Keju Mozzarella", stock: 1800, unit: "g", safety: 500 },
    { id: "i5", name: "Beef Pepperoni", stock: 60, unit: "pcs", safety: 20 },
    { id: "i6", name: "Adonan Pizza Dough", stock: 15, unit: "pcs", safety: 5 },
    { id: "i7", name: "Daun Mint Segar", stock: 300, unit: "g", safety: 100 },
    { id: "i8", name: "Cup Plastik 16oz", stock: 120, unit: "pcs", safety: 30 }
  ]);

  const [menuItems, setMenuItems] = useState([
    {
      id: "m1",
      name: "Es Kopi Susu Gula Aren",
      category: "Minuman",
      price: 18000,
      image: "https://images.unsplash.com/photo-1541167760496-1628856ab772?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
      recipe: [
        { ingredientId: "i1", qty: 18 },
        { ingredientId: "i2", qty: 120 },
        { ingredientId: "i8", qty: 1 }
      ]
    },
    {
      id: "m2",
      name: "Pepperoni Pizza Slice",
      category: "Makanan",
      price: 25000,
      image: "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
      recipe: [
        { ingredientId: "i3", qty: 80 },
        { ingredientId: "i4", qty: 60 },
        { ingredientId: "i5", qty: 4 },
        { ingredientId: "i6", qty: 0.125 } // 1/8 of a dough
      ]
    },
    {
      id: "m3",
      name: "Iced Mint Mojito",
      category: "Minuman",
      price: 22000,
      image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
      recipe: [
        { ingredientId: "i7", qty: 15 },
        { ingredientId: "i8", qty: 1 }
      ]
    },
    {
      id: "m4",
      name: "Garlic Bread",
      category: "Makanan",
      price: 15000,
      image: "https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
      recipe: [
        { ingredientId: "i4", qty: 20 }
      ]
    }
  ]);

  const [activeSessions, setActiveSessions] = useState([
    {
      id: "sess_t2",
      tableId: "t2",
      orders: [
        { id: "ord_1", items: [{ menuId: "m1", name: "Es Kopi Susu Gula Aren", qty: 2, price: 18000, notes: "Less ice" }] }
      ]
    },
    {
      id: "sess_t3",
      tableId: "t3",
      orders: [
        { id: "ord_2", items: [{ menuId: "m2", name: "Pepperoni Pizza Slice", qty: 2, price: 25000, notes: "" }] }
      ]
    },
    {
      id: "sess_t202",
      tableId: "t202",
      orders: [
        { id: "ord_3", items: [{ menuId: "m2", name: "Pepperoni Pizza Slice", qty: 4, price: 25000, notes: "Ekstra Keju" }] }
      ]
    }
  ]);

  const [kdsTickets, setKdsTickets] = useState([
    { id: "tkt_1", tableLabel: "Meja 02", station: "Bar", time: "10 mnt lalu", items: [{ name: "Es Kopi Susu Gula Aren", qty: 2, notes: "Less ice", status: "Cooking" }] },
    { id: "tkt_2", tableLabel: "Meja 03", station: "Kitchen", time: "8 mnt lalu", items: [{ name: "Pepperoni Pizza Slice", qty: 2, notes: "", status: "Pending" }] },
    { id: "tkt_3", tableLabel: "VIP Sofa B", station: "Kitchen", time: "5 mnt lalu", items: [{ name: "Pepperoni Pizza Slice", qty: 4, notes: "Ekstra Keju", status: "Pending" }] }
  ]);

  const [inventoryLogs, setInventoryLogs] = useState([
    { time: "Baru saja", item: "Es Kopi Susu Gula Aren", change: "Biji Kopi -36g, Fresh Milk -240ml", type: "Sales" },
    { time: "5 mnt lalu", item: "Spilage/Wasted", change: "Fresh Milk -1000ml (Basi)", type: "Waste" }
  ]);

  // --- FLOATING CONTROL FOR DETAIL PANELS ---
  const [selectedTable, setSelectedTable] = useState(null);
  const [newTableName, setNewTableName] = useState("");
  const [newTableCapacity, setNewTableCapacity] = useState("4");
  const [newTableShape, setNewTableShape] = useState("rectangle");

  // --- QR ORDER & CART STATE ---
  const [selectedQrTable, setSelectedQrTable] = useState("t1");
  const [qrCart, setQrCart] = useState([]);
  const [qrModifiers, setQrModifiers] = useState({ sugar: "Normal", ice: "Normal", notes: "" });
  const [activeQrCategory, setActiveQrCategory] = useState("Semua");
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  // --- BILL SPLITTING STATE ---
  const [isSplitBillOpen, setIsSplitBillOpen] = useState(false);
  const [splitItems, setSplitItems] = useState([]);

  // --- INGREDIENT & BOM MANAGEMENT STATE ---
  const [showAddIngForm, setShowAddIngForm] = useState(false);
  const [ingForm, setIngForm] = useState({ name: "", stock: "", unit: "g", safety: "" });
  const [showAddMenuForm, setShowAddMenuForm] = useState(false);
  const [menuForm, setMenuForm] = useState({ name: "", category: "Makanan", price: "", image: "" });
  const [editingBomMenuId, setEditingBomMenuId] = useState(null);
  const [selectedBomIngId, setSelectedBomIngId] = useState("");
  const [bomIngQty, setBomIngQty] = useState("");

  const handleAddIngredientSubmit = (e) => {
    e.preventDefault();
    if (!ingForm.name || !ingForm.stock) return;
    const newIng = {
      id: "i_" + Date.now(),
      name: ingForm.name,
      stock: parseFloat(ingForm.stock) || 0,
      unit: ingForm.unit || "g",
      safety: parseFloat(ingForm.safety) || 100
    };
    setIngredients(prev => [...prev, newIng]);
    setIngForm({ name: "", stock: "", unit: "g", safety: "" });
    setShowAddIngForm(false);
  };

  const handleDeleteIngredient = (id) => {
    setIngredients(prev => prev.filter(i => i.id !== id));
    setMenuItems(prev => prev.map(m => ({
      ...m,
      recipe: m.recipe.filter(r => r.ingredientId !== id)
    })));
  };

  const handleAddMenuSubmit = (e) => {
    e.preventDefault();
    if (!menuForm.name || !menuForm.price) return;
    const newM = {
      id: "m_" + Date.now(),
      name: menuForm.name,
      category: menuForm.category,
      price: parseFloat(menuForm.price) || 0,
      image: menuForm.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60",
      recipe: []
    };
    setMenuItems(prev => [...prev, newM]);
    setMenuForm({ name: "", category: "Makanan", price: "", image: "" });
    setShowAddMenuForm(false);
  };

  const handleDeleteMenuItem = (id) => {
    setMenuItems(prev => prev.filter(m => m.id !== id));
  };

  const handleAddBomItem = (menuId) => {
    if (!selectedBomIngId || !bomIngQty) return;
    setMenuItems(prev => prev.map(m => {
      if (m.id === menuId) {
        const exist = m.recipe.find(r => r.ingredientId === selectedBomIngId);
        if (exist) {
          return {
            ...m,
            recipe: m.recipe.map(r => r.ingredientId === selectedBomIngId ? { ...r, qty: parseFloat(bomIngQty) || 0 } : r)
          };
        } else {
          return {
            ...m,
            recipe: [...m.recipe, { ingredientId: selectedBomIngId, qty: parseFloat(bomIngQty) || 0 }]
          };
        }
      }
      return m;
    }));
    setBomIngQty("");
  };

  const handleRemoveBomItem = (menuId, ingId) => {
    setMenuItems(prev => prev.map(m => {
      if (m.id === menuId) {
        return { ...m, recipe: m.recipe.filter(r => r.ingredientId !== ingId) };
      }
      return m;
    }));
  };

  // --- CALCULATE SUMMARY ---
  const getTableSession = (tableId) => activeSessions.find(s => s.tableId === tableId);

  const getTableBillTotal = (tableId) => {
    const session = getTableSession(tableId);
    if (!session) return { subtotal: 0, tax: 0, service: 0, total: 0 };
    let subtotal = 0;
    session.orders.forEach(o => {
      o.items.forEach(it => {
        subtotal += it.price * it.qty;
      });
    });
    const service = Math.round(subtotal * 0.05); // 5% Service
    const tax = Math.round((subtotal + service) * 0.10); // 10% PB1
    const total = subtotal + service + tax;
    return { subtotal, tax, service, total };
  };

  // --- SIMULATION FUNCTIONS ---

  const handleQrSubmit = () => {
    if (qrCart.length === 0) return;

    let session = activeSessions.find(s => s.tableId === selectedQrTable);
    const newOrderItems = qrCart.map(c => ({
      menuId: c.menuItem.id,
      name: c.menuItem.name,
      qty: c.qty,
      price: c.menuItem.price,
      notes: `${c.mods.sugar !== "Normal" ? `Gula: ${c.mods.sugar}, ` : ""}${c.mods.ice !== "Normal" ? `Es: ${c.mods.ice}, ` : ""}${c.mods.notes}`.trim().replace(/,$/, "")
    }));

    if (!session) {
      session = {
        id: "sess_" + Date.now(),
        tableId: selectedQrTable,
        orders: []
      };
      setActiveSessions(prev => [...prev, session]);
      setTables(prev => prev.map(t => t.id === selectedQrTable ? { ...t, status: "Dining" } : t));
    }

    const newOrderId = "ord_" + Date.now();
    setActiveSessions(prev => prev.map(s => {
      if (s.tableId === selectedQrTable) {
        return {
          ...s,
          orders: [...s.orders, { id: newOrderId, items: newOrderItems }]
        };
      }
      return s;
    }));

    const targetTable = tables.find(t => t.id === selectedQrTable);
    newOrderItems.forEach(item => {
      const menuItem = menuItems.find(m => m.id === item.menuId);
      const station = menuItem.category === "Minuman" ? "Bar" : "Kitchen";
      setKdsTickets(prev => [
        ...prev,
        {
          id: "tkt_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
          tableLabel: targetTable ? targetTable.label : "Table",
          station: station,
          time: "Baru saja",
          items: [{ name: item.name, qty: item.qty, notes: item.notes, status: "Pending" }]
        }
      ]);

      menuItem.recipe.forEach(rec => {
        setIngredients(prev => prev.map(ing => {
          if (ing.id === rec.ingredientId) {
            const deduction = rec.qty * item.qty;
            return { ...ing, stock: Math.max(0, ing.stock - deduction) };
          }
          return ing;
        }));
      });
    });

    const changeDesc = newOrderItems.map(item => {
      const mItem = menuItems.find(m => m.id === item.menuId);
      return mItem.recipe.map(r => {
        const ing = ingredients.find(i => i.id === r.ingredientId);
        return `${ing.name} -${r.qty * item.qty}${ing.unit}`;
      }).join(", ");
    }).join(", ");

    setInventoryLogs(prev => [
      { time: "Baru saja", item: newOrderItems.map(i => `${i.qty}x ${i.name}`).join(", "), change: changeDesc, type: "Sales" },
      ...prev
    ]);

    setQrCart([]);
    setCheckoutSuccess(true);
    setTimeout(() => setCheckoutSuccess(false), 3000);
  };

  const handleAddTable = (e) => {
    e.preventDefault();
    if (!newTableName) return;
    const newId = "t_" + Date.now();
    setTables(prev => [
      ...prev,
      {
        id: newId,
        floorId: selectedFloor,
        label: newTableName,
        capacity: parseInt(newTableCapacity),
        status: "Vacant",
        x: Math.floor(Math.random() * 60) + 10,
        y: Math.floor(Math.random() * 60) + 15,
        w: parseInt(newTableCapacity) > 4 ? 28 : 22,
        h: 20,
        shape: newTableShape
      }
    ]);
    setNewTableName("");
  };

  const handleTableStatusChange = (tableId, newStatus) => {
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, status: newStatus } : t));
    if (newStatus === "Vacant") {
      setActiveSessions(prev => prev.filter(s => s.tableId !== tableId));
    }
  };

  const handleKdsStatusCycle = (ticketId) => {
    setKdsTickets(prev => prev.map(t => {
      if (t.id === ticketId) {
        const currentStatus = t.items[0].status;
        let nextStatus = currentStatus;
        if (currentStatus === "Pending") nextStatus = "Cooking";
        else if (currentStatus === "Cooking") nextStatus = "Ready";
        else if (currentStatus === "Ready") nextStatus = "Served";
        return {
          ...t,
          items: [{ ...t.items[0], status: nextStatus }]
        };
      }
      return t;
    }).filter(t => t.items[0].status !== "Served"));
  };

  const handleLogWaste = (ingredientId, qty, reason) => {
    setIngredients(prev => prev.map(ing => {
      if (ing.id === ingredientId) {
        return { ...ing, stock: Math.max(0, ing.stock - qty) };
      }
      return ing;
    }));
    const ingName = ingredients.find(i => i.id === ingredientId)?.name || "Bahan";
    const ingUnit = ingredients.find(i => i.id === ingredientId)?.unit || "unit";
    setInventoryLogs(prev => [
      { time: "Baru saja", item: `Wasted: ${ingName}`, change: `${ingName} -${qty}${ingUnit} (${reason})`, type: "Waste" },
      ...prev
    ]);
  };

  const filteredMenuItems = useMemo(() => {
    if (activeQrCategory === "Semua") return menuItems;
    return menuItems.filter(m => m.category === activeQrCategory);
  }, [activeQrCategory, menuItems]);

  const [billingTab, setBillingTab] = useState("normal");
  const [splitResult, setSplitResult] = useState(null);

  const calculateSplit = (ways) => {
    const bill = getTableBillTotal(selectedTable?.id);
    if (!bill.total) return;
    const splitAmount = Math.ceil(bill.total / ways);
    setSplitResult({
      ways,
      amountPerPerson: splitAmount
    });
  };

  return (
    <div className="min-h-screen bg-[hsl(36_17%_97%)] text-[hsl(0_0%_11%)] antialiased font-sans">
      
      {/* HEADER NAVIGATION */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-amber-100 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-lg bg-amber-600 flex items-center justify-center text-white group-hover:scale-105 transition-transform duration-300">
              <Utensils size={18} />
            </div>
            <div>
              <span className="font-display font-black text-xl tracking-tight text-amber-700">DapurOS</span>
              <span className="text-[10px] block text-[hsl(var(--muted))] -mt-1 font-semibold">by DagangOS</span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold text-[hsl(var(--muted))]">
            <a href="#about" className="hover:text-amber-700 transition-colors">Sekilas</a>
            <a href="#features" className="hover:text-amber-700 transition-colors">Fitur Utama</a>
            <a href="#demo" className="hover:text-amber-700 transition-colors">Simulator Live</a>
            <a href="#pricing" className="hover:text-amber-700 transition-colors">Harga Paket</a>
            <a href="#faq" className="hover:text-amber-700 transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <Link
                to="/app/dashboard"
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/20 transition-all duration-300"
                data-testid="nav-dashboard-btn"
              >
                Buka Dashboard Software &rarr;
              </Link>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 rounded-lg text-slate-700 hover:text-amber-700 hover:bg-amber-100/50 font-bold text-xs transition-all duration-300 border border-amber-200/60"
                data-testid="nav-login-btn"
              >
                Masuk / Login
              </Link>
            )}
            <a
              href="https://wa.me/628999155182?text=Halo%20DagangOS%2C%20saya%20ingin%20mencoba%20DapurOS%20untuk%20restoran%20saya."
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline border-amber-200 text-amber-800 hover:bg-amber-50 hover:border-amber-400 py-2 px-4 text-xs font-bold rounded-lg transition-all duration-300"
            >
              Hubungi Sales
            </a>
            <a
              href="#demo"
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-lg text-xs transition-all duration-300 shadow-md shadow-amber-600/20"
            >
              Coba Demo
            </a>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-20 pb-28 overflow-hidden bg-gradient-to-b from-amber-50/70 via-orange-50/20 to-transparent">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100/80 text-amber-800 text-xs font-bold animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-600" />
              <span>Sistem Operasi F&B Pertama di Indonesia dengan Recipe-BOM Sync</span>
            </div>
            
            <h1 className="font-display text-5xl md:text-6xl font-black tracking-tight leading-[1.05] text-slate-900">
              Menghubungkan <span className="text-amber-600">Meja, Dapur,</span> & <span className="text-amber-600">Inventaris</span> dalam Satu Kedipan Mata.
            </h1>
            
            <p className="text-base md:text-lg text-slate-600 max-w-2xl leading-relaxed">
              DapurOS dirancang khusus untuk restoran, kafe, bar, dan bistro. Memungkinkan pelanggan memesan lewat QR atau tablet meja, merutekan pesanan langsung ke KDS dapur, dan memotong stok bahan mentah otomatis per gram.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link to="/login" className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-6 py-3.5 rounded-xl text-sm transition-all duration-300 shadow-lg shadow-amber-600/30 flex items-center gap-2 group" data-testid="dapuros-hero-login">
                Masuk / Login Akun <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <a href="#demo" className="bg-white hover:bg-slate-50 border border-slate-200 font-extrabold px-6 py-3.5 rounded-xl text-sm transition-all duration-300">
                Mulai Simulator Live
              </a>
              <a href="#pricing" className="bg-white hover:bg-slate-50 border border-slate-200 font-extrabold px-6 py-3.5 rounded-xl text-sm transition-all duration-300">
                Lihat Paket Harga
              </a>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-slate-500 pt-3">
              <span className="flex items-center gap-1.5"><Check size={14} className="text-amber-600" /> Multi-Lantai Dinamis</span>
              <span className="flex items-center gap-1.5"><Check size={14} className="text-amber-600" /> Tablet Meja Kiosk</span>
              <span className="flex items-center gap-1.5"><Check size={14} className="text-amber-600" /> Grab/Gojek API Ready</span>
            </div>
          </div>

          <div className="lg:col-span-5 relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-amber-200 to-orange-100 rounded-full blur-3xl opacity-30 -z-10" />
            <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-400" />
                  <span className="w-3 h-3 rounded-full bg-yellow-400" />
                  <span className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded">Preview Dashboard</span>
              </div>
              <img
                src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80"
                alt="DapurOS Kitchen Display"
                className="w-full h-48 object-cover rounded-lg mb-4"
              />
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 bg-amber-50/50 rounded-lg text-center border border-amber-100/50">
                  <span className="block text-2xl font-black text-amber-700">99.8%</span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Akurasi Stok</span>
                </div>
                <div className="p-3 bg-amber-50/50 rounded-lg text-center border border-amber-100/50">
                  <span className="block text-2xl font-black text-amber-700">&lt;1s</span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Kecepatan KDS</span>
                </div>
                <div className="p-3 bg-amber-50/50 rounded-lg text-center border border-amber-100/50">
                  <span className="block text-2xl font-black text-amber-700">+30%</span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Efisiensi Waiter</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* VALUE PROPOSITIONS */}
      <section id="features" className="py-20 border-t border-amber-100/60 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-amber-600 font-bold uppercase tracking-wider text-xs block">Keunggulan Utama</span>
            <h2 className="font-display text-4xl font-extrabold text-slate-900 mt-2">Didesain Khusus untuk Operasional Kafe & Restoran</h2>
            <p className="text-slate-500 mt-3 text-sm md:text-base">
              Menghilangkan kesalahan komunikasi, meminimalisir kebocoran bahan baku, dan memangkas waktu tunggu tamu.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl border border-slate-100 hover:border-amber-300 transition-all hover:shadow-lg bg-[hsl(36_17%_99%)] text-left">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-5">
                <Layers size={22} />
              </div>
              <h3 className="font-display text-lg font-bold mb-2">Denah Meja Kustom & Multi-Floor</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Sesuaikan layout digital POS dengan susunan fisik meja kafe Anda. Kelola reservasi, buka bill baru, gabungkan meja, atau split pembayaran per kursi.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-100 hover:border-amber-300 transition-all hover:shadow-lg bg-[hsl(36_17%_99%)] text-left">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-5">
                <ChefHat size={22} />
              </div>
              <h3 className="font-display text-lg font-bold mb-2">Kitchen Display System (KDS)</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Gantikan kertas struk dapur yang berantakan. Tampilkan pesanan secara real-time di layar tablet dapur (makanan) dan bar (minuman) lengkap dengan pencatat waktu pengerjaan.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-100 hover:border-amber-300 transition-all hover:shadow-lg bg-[hsl(36_17%_99%)] text-left">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-5">
                <QrCode size={22} />
              </div>
              <h3 className="font-display text-lg font-bold mb-2">QR Self-Order & Tablet Meja</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Biarkan pelanggan memesan langsung dari HP mereka melalui scan QR atau tablet yang terpasang di meja. Pesanan langsung masuk ke kasir dan layar dapur.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-100 hover:border-amber-300 transition-all hover:shadow-lg bg-[hsl(36_17%_99%)] text-left">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-5">
                <Database size={22} />
              </div>
              <h3 className="font-display text-lg font-bold mb-2">BOM Recipe & Stok Bahan Baku</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Sistem menghitung HPP resep otomatis. Penjualan menu (misal: Latte) langsung memotong stok bahan baku (biji kopi & susu) secara real-time. Log barang rusak/spoilage terintegrasi.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-100 hover:border-amber-300 transition-all hover:shadow-lg bg-[hsl(36_17%_99%)] text-left">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-5">
                <Store size={22} />
              </div>
              <h3 className="font-display text-lg font-bold mb-2">GrabFood & GoFood Sync</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Kelola menu dan pesanan online delivery GrabFood/GoFood langsung dari tablet DapurOS Anda. Makanan langsung masuk ke KDS dapur tanpa perlu input manual.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-100 hover:border-amber-300 transition-all hover:shadow-lg bg-[hsl(36_17%_99%)] text-left">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-5">
                <CreditCard size={22} />
              </div>
              <h3 className="font-display text-lg font-bold mb-2">Integrasi EDC & Split-Bill</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Kirim nominal pembayaran langsung ke mesin EDC (BCA, Mandiri, dll) tanpa pengetikan manual. Bebaskan pelanggan membayar dengan cara patungan (split-bill).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* INTERACTIVE SIMULATOR (WOW FACTOR) */}
      <section id="demo" className="py-20 bg-slate-900 text-white overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(217,119,6,0.15),transparent_50%)]" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-amber-500 font-bold uppercase tracking-wider text-xs block">Simulasi Interaktif (Demo)</span>
            <h2 className="font-display text-4xl font-extrabold mt-2 text-white">Rasakan Alur DapurOS Secara Live</h2>
            <p className="text-slate-400 mt-3 text-sm">
              Cobalah alur kerja F&B terintegrasi kami: buat pesanan di HP Pelanggan (Tab 3), lihat pesanan langsung masuk KDS Dapur (Tab 2) dan Table Map (Tab 1), serta saksikan pengurangan stok bahan mentah (Tab 4) secara instan!
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex border-b border-slate-800 bg-slate-900/60 overflow-x-auto">
              <button
                onClick={() => setActiveTab("floor")}
                className={`flex items-center gap-2 px-6 py-4 text-xs md:text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${activeTab === "floor" ? "border-amber-500 text-amber-500 bg-slate-950" : "border-transparent text-slate-400 hover:text-slate-200"}`}
              >
                <Store size={16} /> FOH: Denah Meja & POS
              </button>
              <button
                onClick={() => setActiveTab("kds")}
                className={`flex items-center gap-2 px-6 py-4 text-xs md:text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${activeTab === "kds" ? "border-amber-500 text-amber-500 bg-slate-950" : "border-transparent text-slate-400 hover:text-slate-200"}`}
              >
                <ChefHat size={16} /> BOH: Kitchen & Bar (KDS)
              </button>
              <button
                onClick={() => setActiveTab("qr")}
                className={`flex items-center gap-2 px-6 py-4 text-xs md:text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${activeTab === "qr" ? "border-amber-500 text-amber-500 bg-slate-950" : "border-transparent text-slate-400 hover:text-slate-200"}`}
              >
                <QrCode size={16} /> Self-Order QR (Phone View)
              </button>
              <button
                onClick={() => setActiveTab("inventory")}
                className={`flex items-center gap-2 px-6 py-4 text-xs md:text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${activeTab === "inventory" ? "border-amber-500 text-amber-500 bg-slate-950" : "border-transparent text-slate-400 hover:text-slate-200"}`}
              >
                <Database size={16} /> Inventaris Resep (BOM)
              </button>
            </div>

            <div className="p-6 min-h-[580px] bg-slate-950">
              {activeTab === "floor" && (
                <div className="grid lg:grid-cols-12 gap-6 animate-fadein">
                  <div className="lg:col-span-8 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        {floors.map(fl => (
                          <button
                            key={fl.id}
                            onClick={() => setSelectedFloor(fl.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedFloor === fl.id ? "bg-amber-600 text-white" : "bg-slate-900 text-slate-400 hover:bg-slate-800"}`}
                          >
                            {fl.name}
                          </button>
                        ))}
                      </div>
                      <span className="text-slate-500 text-[10px] uppercase font-bold flex items-center gap-1">
                        <Wifi size={12} className="text-emerald-500" /> Live Synchronized
                      </span>
                    </div>

                    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 min-h-[380px] relative overflow-hidden flex flex-col justify-between">
                      <div className="absolute inset-0 bg-grid-slate-800/10 pointer-events-none" />
                      <div className="grid grid-cols-3 md:grid-cols-4 gap-4 relative z-10">
                        {tables.filter(t => t.floorId === selectedFloor).map(t => {
                          const isSelected = selectedTable?.id === t.id;
                          let statusBg = "bg-slate-800 border-slate-700 hover:border-slate-500";
                          let statusText = "Vacant";
                          let colorDot = "bg-slate-500";
                          if (t.status === "Dining") {
                            statusBg = "bg-red-950/40 border-red-800/80 hover:border-red-600";
                            statusText = "Dining";
                            colorDot = "bg-red-500";
                          } else if (t.status === "Billing") {
                            statusBg = "bg-blue-950/40 border-blue-800/80 hover:border-blue-600";
                            statusText = "Billing";
                            colorDot = "bg-blue-400 animate-pulse";
                          } else if (t.status === "Seated") {
                            statusBg = "bg-yellow-950/30 border-yellow-800/60 hover:border-yellow-500";
                            statusText = "Seated";
                            colorDot = "bg-yellow-500";
                          }

                          return (
                            <button
                              key={t.id}
                              onClick={() => setSelectedTable(t)}
                              className={`p-4 rounded-xl border flex flex-col items-center justify-between transition-all duration-200 relative min-h-[100px] ${statusBg} ${isSelected ? "ring-2 ring-amber-500 scale-[1.03]" : ""}`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className={`w-2 h-2 rounded-full ${colorDot}`} />
                                <span className="text-[10px] text-slate-500 font-bold">{t.capacity} Pax</span>
                              </div>
                              <span className="font-display font-black text-sm md:text-base text-slate-100">{t.label}</span>
                              <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400">{statusText}</span>
                            </button>
                          );
                        })}
                      </div>

                      <form onSubmit={handleAddTable} className="border-t border-slate-800 pt-4 mt-6 flex flex-wrap items-center gap-3 relative z-10 text-left">
                        <span className="text-xs font-bold text-slate-400">Desain Layout:</span>
                        <input
                          type="text"
                          placeholder="Nama Meja"
                          value={newTableName}
                          onChange={(e) => setNewTableName(e.target.value)}
                          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                        />
                        <select
                          value={newTableCapacity}
                          onChange={(e) => setNewTableCapacity(e.target.value)}
                          className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                        >
                          <option value="2">2 Kursi</option>
                          <option value="4">4 Kursi</option>
                          <option value="6">6 Kursi</option>
                          <option value="8">8 Kursi</option>
                        </select>
                        <select
                          value={newTableShape}
                          onChange={(e) => setNewTableShape(e.target.value)}
                          className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                        >
                          <option value="rectangle">Kotak</option>
                          <option value="circle">Bulat</option>
                        </select>
                        <button type="submit" className="bg-slate-800 hover:bg-amber-600 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 transition-colors">
                          <Plus size={14} /> Pasang Meja
                        </button>
                      </form>
                    </div>
                  </div>

                  <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between text-left">
                    {selectedTable ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                          <div>
                            <h3 className="font-display font-black text-lg text-slate-100">{selectedTable.label}</h3>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">
                              Lantai: {floors.find(f => f.id === selectedTable.floorId)?.name}
                            </span>
                          </div>
                          <select
                            value={selectedTable.status}
                            onChange={(e) => handleTableStatusChange(selectedTable.id, e.target.value)}
                            className="bg-slate-955 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none"
                          >
                            <option value="Vacant">Kosong</option>
                            <option value="Seated">Tamu Duduk</option>
                            <option value="Dining">Makan (Dining)</option>
                            <option value="Billing">Tagihan (Billing)</option>
                          </select>
                        </div>

                        <div className="space-y-3 min-h-[160px]">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pesanan Aktif:</span>
                          {getTableSession(selectedTable.id) ? (
                            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                              {getTableSession(selectedTable.id).orders.map(o => (
                                <div key={o.id} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 space-y-1">
                                  {o.items.map((it, idx) => (
                                    <div key={idx} className="flex justify-between items-start text-xs">
                                      <div className="space-y-0.5">
                                        <p className="font-bold text-slate-200">{it.qty}x {it.name}</p>
                                        {it.notes && <p className="text-[10px] text-amber-500 italic">"{it.notes}"</p>}
                                      </div>
                                      <span className="text-slate-400 font-semibold text-[11px] num-display">
                                        Rp {(it.price * it.qty).toLocaleString()}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="h-28 flex items-center justify-center border border-dashed border-slate-800 rounded-lg text-slate-600 text-xs">
                              Tidak ada pesanan. Silakan isi order di Tab "Self-Order QR"
                            </div>
                          )}
                        </div>

                        {getTableSession(selectedTable.id) && (
                          <div className="border-t border-slate-800 pt-3 space-y-1.5 text-xs text-slate-400">
                            <div className="flex justify-between">
                              <span>Subtotal</span>
                              <span className="num-display">Rp {getTableBillTotal(selectedTable.id).subtotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Service Charge (5%)</span>
                              <span className="num-display">Rp {getTableBillTotal(selectedTable.id).service.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Resto Tax PB1 (10%)</span>
                              <span className="num-display">Rp {getTableBillTotal(selectedTable.id).tax.toLocaleString()}</span>
                            </div>
                            
                            {billingTab === "split" && splitResult && (
                              <div className="bg-slate-950 p-2.5 rounded-lg border border-amber-900/30 text-slate-200 mt-2 space-y-1">
                                <div className="flex justify-between text-[11px] text-slate-400">
                                  <span>Tagihan Dibagi {splitResult.ways} Orang</span>
                                </div>
                                <div className="flex justify-between font-black text-amber-500 text-sm">
                                  <span>Per Orang:</span>
                                  <span className="num-display">Rp {splitResult.amountPerPerson.toLocaleString()}</span>
                                </div>
                              </div>
                            )}

                            <div className="flex justify-between border-t border-slate-800 pt-2 font-bold text-slate-200 text-sm">
                              <span>Total Tagihan</span>
                              <span className="text-amber-500 num-display">Rp {getTableBillTotal(selectedTable.id).total.toLocaleString()}</span>
                            </div>
                          </div>
                        )}

                        {getTableSession(selectedTable.id) && (
                          <div className="space-y-2 pt-2 border-t border-slate-800">
                            {billingTab === "normal" ? (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setBillingTab("split")}
                                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2 rounded-lg text-xs transition-colors"
                                >
                                  Opsi Split Bill
                                </button>
                                <button
                                  onClick={() => handleTableStatusChange(selectedTable.id, "Vacant")}
                                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1"
                                >
                                  <CheckCircle2 size={12} /> Settle / Bayar
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex gap-1 items-center justify-between bg-slate-950 p-1 rounded-lg border border-slate-800">
                                  <button onClick={() => calculateSplit(2)} className="flex-1 py-1 text-[10px] font-bold rounded bg-slate-900 hover:bg-slate-800 text-slate-300">2-Way</button>
                                  <button onClick={() => calculateSplit(3)} className="flex-1 py-1 text-[10px] font-bold rounded bg-slate-900 hover:bg-slate-800 text-slate-300">3-Way</button>
                                  <button onClick={() => calculateSplit(4)} className="flex-1 py-1 text-[10px] font-bold rounded bg-slate-900 hover:bg-slate-800 text-slate-300">4-Way</button>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => { setBillingTab("normal"); setSplitResult(null); }}
                                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 py-1.5 rounded-lg text-xs font-bold"
                                  >
                                    Batal Split
                                  </button>
                                  <button
                                    onClick={() => { handleTableStatusChange(selectedTable.id, "Vacant"); setBillingTab("normal"); setSplitResult(null); }}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 rounded-lg text-xs font-bold"
                                  >
                                    Bayar Per Orang
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center text-slate-600 space-y-3 py-10">
                        <Store size={40} className="text-slate-800" />
                        <div>
                          <p className="font-bold text-slate-400">Pilih Meja</p>
                          <p className="text-[11px] text-slate-500 max-w-[200px]">Klik salah satu meja di layout sebelah kiri untuk melihat rincian tagihan FOH.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "kds" && (
                <div className="space-y-6 animate-fadein">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-left">
                    <div className="flex gap-3">
                      <span className="text-sm font-bold text-slate-300">Stasiun KDS:</span>
                      <span className="text-xs text-amber-500 font-bold bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1">
                        <Wifi size={10} /> Online & Sync
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">Klik pada tiket untuk mengganti status pengerjaan</span>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between bg-slate-900/60 p-3 border border-slate-800 rounded-xl text-left">
                        <span className="text-xs font-black text-slate-200 tracking-wider uppercase flex items-center gap-1.5">
                          <ChefHat size={14} className="text-amber-500" /> Station: Dapur (Makanan)
                        </span>
                        <span className="text-[10px] bg-slate-800 text-slate-400 font-bold px-2 py-0.5 rounded">
                          {kdsTickets.filter(t => t.station === "Kitchen").length} Antrean
                        </span>
                      </div>

                      <div className="space-y-3">
                        {kdsTickets.filter(t => t.station === "Kitchen").map(ticket => {
                          const item = ticket.items[0];
                          let ticketColor = "border-slate-800 bg-slate-900";
                          let btnColor = "bg-slate-800 hover:bg-amber-600 text-slate-350";
                          let btnText = "Mulai Masak";
                          if (item.status === "Cooking") {
                            ticketColor = "border-amber-700/60 bg-amber-955/20";
                            btnColor = "bg-amber-600 hover:bg-emerald-600 text-white";
                            btnText = "Siap Sajikan";
                          } else if (item.status === "Ready") {
                            ticketColor = "border-emerald-700/60 bg-emerald-955/20";
                            btnColor = "bg-emerald-600 hover:bg-slate-800 text-white";
                            btnText = "Tandai Sajikan";
                          }

                          return (
                            <div key={ticket.id} className={`p-4 rounded-xl border space-y-3 text-left transition-all duration-300 ${ticketColor}`}>
                              <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800/80 pb-1.5">
                                <span className="font-bold text-slate-200">{ticket.tableLabel}</span>
                                <span className="flex items-center gap-1 text-[10px]"><Clock size={10} /> {ticket.time}</span>
                              </div>
                              <div className="space-y-1">
                                <p className="text-sm font-black text-slate-100">{item.qty}x {item.name}</p>
                                {item.notes && <p className="text-[10px] text-amber-500 font-bold italic uppercase">{item.notes}</p>}
                              </div>
                              <button
                                onClick={() => handleKdsStatusCycle(ticket.id)}
                                className={`w-full py-1.5 rounded-lg text-xs font-bold transition-colors ${btnColor}`}
                              >
                                {btnText}
                              </button>
                            </div>
                          );
                        })}
                        {kdsTickets.filter(t => t.station === "Kitchen").length === 0 && (
                          <div className="py-12 border border-dashed border-slate-800 rounded-xl text-center text-xs text-slate-650">
                            Antrean Dapur Bersih.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between bg-slate-900/60 p-3 border border-slate-800 rounded-xl text-left">
                        <span className="text-xs font-black text-slate-200 tracking-wider uppercase flex items-center gap-1.5">
                          <Wine size={14} className="text-amber-500" /> Station: Bar (Minuman)
                        </span>
                        <span className="text-[10px] bg-slate-800 text-slate-400 font-bold px-2 py-0.5 rounded">
                          {kdsTickets.filter(t => t.station === "Bar").length} Antrean
                        </span>
                      </div>

                      <div className="space-y-3">
                        {kdsTickets.filter(t => t.station === "Bar").map(ticket => {
                          const item = ticket.items[0];
                          let ticketColor = "border-slate-800 bg-slate-900";
                          let btnColor = "bg-slate-800 hover:bg-amber-600 text-slate-350";
                          let btnText = "Mulai Buat";
                          if (item.status === "Cooking") {
                            ticketColor = "border-amber-700/60 bg-amber-955/20";
                            btnColor = "bg-amber-600 hover:bg-emerald-600 text-white";
                            btnText = "Minuman Ready";
                          } else if (item.status === "Ready") {
                            ticketColor = "border-emerald-700/60 bg-emerald-955/20";
                            btnColor = "bg-emerald-600 hover:bg-slate-800 text-white";
                            btnText = "Tandai Sajikan";
                          }

                          return (
                            <div key={ticket.id} className={`p-4 rounded-xl border space-y-3 text-left transition-all duration-300 ${ticketColor}`}>
                              <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800/80 pb-1.5">
                                <span className="font-bold text-slate-200">{ticket.tableLabel}</span>
                                <span className="flex items-center gap-1 text-[10px]"><Clock size={10} /> {ticket.time}</span>
                              </div>
                              <div className="space-y-1">
                                <p className="text-sm font-black text-slate-100">{item.qty}x {item.name}</p>
                                {item.notes && <p className="text-[10px] text-amber-500 font-bold italic uppercase">{item.notes}</p>}
                              </div>
                              <button
                                onClick={() => handleKdsStatusCycle(ticket.id)}
                                className={`w-full py-1.5 rounded-lg text-xs font-bold transition-colors ${btnColor}`}
                              >
                                {btnText}
                              </button>
                            </div>
                          );
                        })}
                        {kdsTickets.filter(t => t.station === "Bar").length === 0 && (
                          <div className="py-12 border border-dashed border-slate-800 rounded-xl text-center text-xs text-slate-650">
                            Antrean Bar Bersih.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4 text-left">
                        <span className="text-xs font-black tracking-wider uppercase text-slate-200 flex items-center gap-1.5">
                          <LineChart size={14} className="text-amber-500" /> Analisis KDS & SLA
                        </span>
                        
                        <div className="space-y-3 text-xs">
                          <div className="p-3 bg-slate-950 rounded-lg border border-slate-850 space-y-1.5">
                            <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                              <span>RATA-RATA WAKTU PENYAJIAN</span>
                            </div>
                            <div className="flex items-baseline gap-1 text-slate-100">
                              <span className="text-2xl font-black text-amber-500">11.4</span>
                              <span className="font-bold text-slate-400">Menit</span>
                            </div>
                          </div>

                          <div className="p-3 bg-slate-950 rounded-lg border border-slate-850 space-y-1.5">
                            <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                              <span>CAPAIAN TARGET SLA (15 MINS)</span>
                            </div>
                            <div className="flex items-baseline gap-1 text-slate-100">
                              <span className="text-2xl font-black text-emerald-500">96.7%</span>
                              <span className="font-bold text-slate-400">Tepat Waktu</span>
                            </div>
                          </div>

                          <div className="space-y-2 pt-2 border-t border-slate-800/60 text-slate-400 text-[11px]">
                            <p className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" /> Pending: Pesanan antre masuk.
                            </p>
                            <p className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Cooking: Chef sedang memasak.
                            </p>
                            <p className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Ready: Makanan siap antar.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "qr" && (
                <div className="grid lg:grid-cols-12 gap-8 items-center justify-center animate-fadein text-left">
                  <div className="lg:col-span-5 space-y-5 text-slate-300">
                    <span className="text-xs uppercase font-black tracking-wider text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      Simulasi HP Pelanggan
                    </span>
                    <h3 className="font-display font-black text-2xl text-white">QR Code Self-Ordering Menu</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Pilihlah meja penempatan di bagian atas, lakukan pemesanan menu kafe di smartphone demo, lalu checkout. Pesanan ini akan **masuk secara real-time** ke dalam KDS Dapur (Tab 2) dan Table Map (Tab 1)!
                    </p>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 block">Pilih Meja Simulasi Scan QR:</label>
                      <select
                        value={selectedQrTable}
                        onChange={(e) => setSelectedQrTable(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-xs text-white rounded-lg p-2.5 focus:outline-none focus:border-amber-500"
                      >
                        {tables.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.label} ({floors.find(f => f.id === t.floorId)?.name}) - Status: {t.status}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="bg-slate-900/60 border border-slate-800/80 p-3.5 rounded-xl text-xs space-y-2">
                      <p className="font-bold text-slate-300 flex items-center gap-1">
                        <AlertTriangle size={14} className="text-amber-500" /> Skema Demo Terintegrasi
                      </p>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        Saat menekan tombol **"Kirim Pesanan"** di layar HP sebelah kanan, sistem akan menghitung HPP resep menu dan memotong persediaan di Tab **Inventaris Resep (Tab 4)**.
                      </p>
                    </div>
                  </div>

                  <div className="lg:col-span-7 flex justify-center">
                    <div className="w-[320px] h-[550px] bg-slate-900 rounded-[40px] border-4 border-slate-800 shadow-2xl relative overflow-hidden flex flex-col justify-between">
                      <div className="absolute top-0 inset-x-0 h-5 bg-slate-900 flex justify-center z-30">
                        <div className="w-24 h-4 bg-slate-950 rounded-b-xl" />
                      </div>

                      <div className="bg-amber-600 pt-6 pb-3 px-4 text-white z-20 shadow-md">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold">DapurOS Cafe</span>
                          <span className="bg-amber-700/80 px-2 py-0.5 rounded text-[10px] font-black">
                            {tables.find(t => t.id === selectedQrTable)?.label || "Table"}
                          </span>
                        </div>
                        <p className="text-[10px] text-amber-100 font-semibold">Self-Ordering QR Menu</p>
                      </div>

                      <div className="flex-1 overflow-y-auto bg-slate-950 px-3 py-3 space-y-3">
                        {/* Customization & Adjustments Selector */}
                        <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-left space-y-2">
                          <span className="text-[10px] font-black text-amber-400 tracking-wider uppercase block">
                            ⚙ Opsi Penyesuaian (Adjustments)
                          </span>
                          
                          <div className="grid grid-cols-2 gap-1.5 text-[9px]">
                            <div>
                              <span className="text-slate-400 font-bold block mb-0.5">Gula:</span>
                              <div className="flex gap-1">
                                {["Normal", "Less", "No"].map(s => (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => setQrModifiers(prev => ({ ...prev, sugar: s === "Normal" ? "Normal" : s + " Sugar" }))}
                                    className={`px-1.5 py-0.5 rounded font-bold transition-all ${qrModifiers.sugar.includes(s) ? "bg-amber-600 text-white" : "bg-slate-950 text-slate-400 hover:text-slate-200"}`}
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <span className="text-slate-400 font-bold block mb-0.5">Es:</span>
                              <div className="flex gap-1">
                                {["Normal", "Less", "No"].map(i => (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => setQrModifiers(prev => ({ ...prev, ice: i === "Normal" ? "Normal" : i + " Ice" }))}
                                    className={`px-1.5 py-0.5 rounded font-bold transition-all ${qrModifiers.ice.includes(i) ? "bg-amber-600 text-white" : "bg-slate-950 text-slate-400 hover:text-slate-200"}`}
                                  >
                                    {i}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div>
                            <span className="text-slate-400 font-bold block mb-0.5 text-[9px]">Catatan / Request Khusus:</span>
                            <div className="flex gap-1 mb-1 flex-wrap">
                              {["Tanpa Bawang", "Extra Keju", "Pedas"].map(chip => (
                                <button
                                  key={chip}
                                  type="button"
                                  onClick={() => setQrModifiers(prev => ({ ...prev, notes: prev.notes ? prev.notes + ", " + chip : chip }))}
                                  className="px-1.5 py-0.5 bg-slate-950 text-slate-300 text-[8px] font-semibold rounded hover:bg-slate-800"
                                >
                                  + {chip}
                                </button>
                              ))}
                            </div>
                            <input
                              type="text"
                              placeholder="cth: less sugar, no onion..."
                              value={qrModifiers.notes}
                              onChange={(e) => setQrModifiers(prev => ({ ...prev, notes: e.target.value }))}
                              className="w-full bg-slate-950 border border-slate-800 text-[10px] text-slate-200 px-2 py-1 rounded focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>

                        <div className="flex gap-1.5 overflow-x-auto pb-1 border-b border-slate-900">
                          {["Semua", "Makanan", "Minuman"].map(cat => (
                            <button
                              key={cat}
                              onClick={() => setActiveQrCategory(cat)}
                              className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all whitespace-nowrap ${activeQrCategory === cat ? "bg-amber-600 text-white" : "bg-slate-900 text-slate-400 hover:text-slate-200"}`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>

                        {checkoutSuccess && (
                          <div className="bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-[10px] p-2.5 rounded-lg text-center font-bold animate-bounce">
                            ✓ Pesanan Sukses Dikirim ke Dapur!
                          </div>
                        )}

                        <div className="space-y-2">
                          {filteredMenuItems.map(menu => (
                            <div key={menu.id} className="bg-slate-900 border border-slate-850 p-2 rounded-xl flex gap-2 items-center justify-between">
                              <img src={menu.image} alt={menu.name} className="w-12 h-12 object-cover rounded-lg shrink-0" />
                              <div className="flex-1 space-y-0.5 text-left min-w-0">
                                <h4 className="text-[11px] font-black text-slate-100 leading-tight truncate">{menu.name}</h4>
                                <p className="text-[10px] text-slate-500 font-bold">Rp {menu.price.toLocaleString()}</p>
                              </div>
                              <button
                                onClick={() => {
                                  const exist = qrCart.find(c => c.menuItem.id === menu.id);
                                  if (exist) {
                                    setQrCart(prev => prev.map(c => c.menuItem.id === menu.id ? { ...c, qty: c.qty + 1 } : c));
                                  } else {
                                    setQrCart(prev => [...prev, { menuItem: menu, qty: 1, mods: { ...qrModifiers } }]);
                                  }
                                }}
                                className="bg-amber-600 hover:bg-amber-700 text-white font-bold p-1.5 px-2.5 rounded-md text-[10px] transition-colors shrink-0"
                              >
                                + Tambah
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-slate-900 border-t border-slate-800 p-3 space-y-2 z-20">
                        {qrCart.length > 0 ? (
                          <div className="space-y-2">
                            <div className="max-h-[90px] overflow-y-auto space-y-1 text-left">
                              {qrCart.map((c, i) => {
                                const modDesc = `${c.mods.sugar !== "Normal" ? c.mods.sugar + ", " : ""}${c.mods.ice !== "Normal" ? c.mods.ice + ", " : ""}${c.mods.notes}`.trim().replace(/,$/, "");
                                return (
                                  <div key={i} className="flex justify-between items-start text-[10px] text-slate-300 border-b border-slate-850/60 pb-1">
                                    <div>
                                      <span className="font-bold">{c.qty}x {c.menuItem.name}</span>
                                      {modDesc && <p className="text-[8px] text-amber-400 font-medium">({modDesc})</p>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span>Rp {(c.menuItem.price * c.qty).toLocaleString()}</span>
                                      <button
                                        onClick={() => setQrCart(prev => prev.filter(item => item.menuItem.id !== c.menuItem.id))}
                                        className="text-red-500 hover:text-red-400 font-bold"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <button
                              onClick={handleQrSubmit}
                              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                            >
                              Kirim Pesanan (Rp {qrCart.reduce((acc, c) => acc + (c.menuItem.price * c.qty), 0).toLocaleString()})
                            </button>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-600 text-center py-2 font-semibold">Keranjang masih kosong</p>
                        )}
                      </div>

                    </div>
                  </div>
                </div>
              )}

              {activeTab === "inventory" && (
                <div className="grid lg:grid-cols-12 gap-8 animate-fadein text-left">
                  <div className="lg:col-span-7 space-y-4">
                    {ingredients.some(ing => ing.stock <= ing.safety * 2) && (
                      <div className="p-3 bg-amber-950/60 border border-amber-800 text-amber-300 text-xs rounded-xl flex items-center gap-2 font-bold animate-pulse" data-testid="low-stock-alert-banner">
                        <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                        <span>Peringatan Stok Rendah: {ingredients.filter(ing => ing.stock <= ing.safety * 2).map(ing => ing.name).join(", ")} membutuhkan restock!</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-black text-slate-300 tracking-wider uppercase flex items-center gap-1.5">
                        <Package size={14} className="text-amber-500" /> Stok Bahan Baku (Real-time)
                      </span>
                      <button
                        onClick={() => setShowAddIngForm(!showAddIngForm)}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1 rounded text-xs flex items-center gap-1 transition-colors"
                        data-testid="add-ingredient-btn"
                      >
                        <Plus size={12} /> Tambah Bahan Baku
                      </button>
                    </div>

                    {showAddIngForm && (
                      <form onSubmit={handleAddIngredientSubmit} className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs">
                        <p className="font-bold text-slate-200">Tambah Bahan Baku Baru</p>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Nama Bahan (cth: Gula Aren)"
                            value={ingForm.name}
                            onChange={(e) => setIngForm(p => ({ ...p, name: e.target.value }))}
                            className="bg-slate-950 border border-slate-800 p-2 rounded text-slate-200 focus:outline-none focus:border-amber-500"
                            required
                          />
                          <input
                            type="number"
                            placeholder="Stok Awal"
                            value={ingForm.stock}
                            onChange={(e) => setIngForm(p => ({ ...p, stock: e.target.value }))}
                            className="bg-slate-950 border border-slate-800 p-2 rounded text-slate-200 focus:outline-none focus:border-amber-500"
                            required
                          />
                          <input
                            type="text"
                            placeholder="Satuan (g, ml, pcs)"
                            value={ingForm.unit}
                            onChange={(e) => setIngForm(p => ({ ...p, unit: e.target.value }))}
                            className="bg-slate-950 border border-slate-800 p-2 rounded text-slate-200 focus:outline-none focus:border-amber-500"
                          />
                          <input
                            type="number"
                            placeholder="Batas Minimum (Safety)"
                            value={ingForm.safety}
                            onChange={(e) => setIngForm(p => ({ ...p, safety: e.target.value }))}
                            className="bg-slate-950 border border-slate-800 p-2 rounded text-slate-200 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button type="button" onClick={() => setShowAddIngForm(false)} className="px-3 py-1 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 font-semibold">Batal</button>
                          <button type="submit" className="px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 font-bold">Simpan Bahan</button>
                        </div>
                      </form>
                    )}

                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                          <tr>
                            <th className="p-3">Nama Bahan</th>
                            <th className="p-3 text-right">Stok Fisik</th>
                            <th className="p-3 text-center">Status</th>
                            <th className="p-3 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {ingredients.map(ing => {
                            const isCritical = ing.stock <= ing.safety;
                            const isWarning = ing.stock <= ing.safety * 2;
                            return (
                              <tr key={ing.id} className="hover:bg-slate-850/40">
                                <td className="p-3 font-semibold text-slate-200">{ing.name}</td>
                                <td className="p-3 text-right font-mono font-bold">{ing.stock.toLocaleString()}{ing.unit}</td>
                                <td className="p-3 text-center" data-testid={`stock-status-${ing.id}`}>
                                  {isCritical ? (
                                    <span className="inline-block px-2 py-0.5 text-[9px] bg-red-950/60 border border-red-800 text-red-400 font-black rounded-full animate-pulse" data-testid="badge-low-stock">Low Stock Alert</span>
                                  ) : isWarning ? (
                                    <span className="inline-block px-2 py-0.5 text-[9px] bg-amber-950/60 border border-amber-800 text-amber-400 font-black rounded-full" data-testid="badge-warning">Menipis</span>
                                  ) : (
                                    <span className="inline-block px-2 py-0.5 text-[9px] bg-emerald-950/60 border border-emerald-800 text-emerald-400 font-black rounded-full" data-testid="badge-safe">Aman</span>
                                  )}
                                </td>
                                <td className="p-3 text-center flex justify-center gap-1.5">
                                  <button
                                    onClick={() => handleLogWaste(ing.id, ing.id === "i6" ? 1 : 100, "Spilled / Rusak")}
                                    className="bg-slate-800 hover:bg-red-950 hover:text-red-400 font-bold py-1 px-2 rounded text-[10px] transition-colors"
                                  >
                                    Log Spoilage
                                  </button>
                                  <button
                                    onClick={() => handleDeleteIngredient(ing.id)}
                                    className="bg-red-950/80 hover:bg-red-900 text-red-300 font-bold py-1 px-1.5 rounded text-[10px] transition-colors"
                                    title="Hapus Bahan"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="lg:col-span-5 space-y-6">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-xs font-black tracking-wider uppercase text-slate-200 flex items-center gap-1.5">
                          <Database size={14} className="text-amber-500" /> Resep / Bill of Materials (BOM)
                        </span>
                        <button
                          onClick={() => setShowAddMenuForm(!showAddMenuForm)}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-2.5 py-1 rounded text-[10px] flex items-center gap-1 transition-colors"
                          data-testid="add-menu-btn"
                        >
                          <Plus size={12} /> Menu Baru
                        </button>
                      </div>

                      {showAddMenuForm && (
                        <form onSubmit={handleAddMenuSubmit} className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2 text-xs">
                          <p className="font-bold text-slate-200 text-[11px]">Tambah Menu Baru</p>
                          <input
                            type="text"
                            placeholder="Nama Menu"
                            value={menuForm.name}
                            onChange={(e) => setMenuForm(p => ({ ...p, name: e.target.value }))}
                            className="w-full bg-slate-900 border border-slate-800 p-1.5 rounded text-slate-200"
                            required
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={menuForm.category}
                              onChange={(e) => setMenuForm(p => ({ ...p, category: e.target.value }))}
                              className="bg-slate-900 border border-slate-800 p-1.5 rounded text-slate-200"
                            >
                              <option value="Makanan">Makanan</option>
                              <option value="Minuman">Minuman</option>
                            </select>
                            <input
                              type="number"
                              placeholder="Harga (Rp)"
                              value={menuForm.price}
                              onChange={(e) => setMenuForm(p => ({ ...p, price: e.target.value }))}
                              className="bg-slate-900 border border-slate-800 p-1.5 rounded text-slate-200"
                              required
                            />
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <button type="button" onClick={() => setShowAddMenuForm(false)} className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px]">Batal</button>
                            <button type="submit" className="px-2 py-0.5 bg-amber-600 text-white rounded text-[10px] font-bold">Simpan</button>
                          </div>
                        </form>
                      )}
                      
                      <div className="space-y-2.5 text-xs max-h-[350px] overflow-y-auto pr-1">
                        {menuItems.map(menu => (
                          <div key={menu.id} className="p-2.5 bg-slate-950 rounded-lg border border-slate-850 space-y-2">
                            <div className="flex justify-between items-center text-slate-100 font-bold border-b border-slate-900 pb-1">
                              <div>
                                <span className="text-[11px] block leading-tight">{menu.name}</span>
                                <span className="text-[9px] text-slate-500 font-normal">Rp {menu.price.toLocaleString()} • {menu.category}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => setEditingBomMenuId(editingBomMenuId === menu.id ? null : menu.id)}
                                  className={`px-2 py-0.5 rounded text-[9px] font-bold transition-colors ${editingBomMenuId === menu.id ? "bg-amber-600 text-white" : "bg-slate-900 text-amber-400 border border-amber-800/60 hover:bg-amber-950"}`}
                                  data-testid={`edit-bom-btn-${menu.id}`}
                                >
                                  {editingBomMenuId === menu.id ? "Tutup Editor" : "Edit BOM"}
                                </button>
                                <button
                                  onClick={() => handleDeleteMenuItem(menu.id)}
                                  className="text-red-400 hover:text-red-300 p-1"
                                  title="Hapus Menu"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                            <div className="text-[10px] text-slate-400 space-y-1">
                              {menu.recipe.length > 0 ? (
                                menu.recipe.map((rec, i) => {
                                  const ing = ingredients.find(ing => ing.id === rec.ingredientId);
                                  return (
                                    <div key={i} className="flex justify-between items-center bg-slate-900/60 px-2 py-0.5 rounded">
                                      <span>• {ing ? ing.name : "Bahan Terhapus"}</span>
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold text-amber-300">{rec.qty}{ing ? ing.unit : ""}</span>
                                        {editingBomMenuId === menu.id && (
                                          <button
                                            onClick={() => handleRemoveBomItem(menu.id, rec.ingredientId)}
                                            className="text-red-400 hover:text-red-300 font-bold"
                                            title="Hapus Komponen Bahan"
                                          >
                                            ✕
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                <p className="text-[9px] text-slate-600 italic">Belum ada resep bahan baku</p>
                              )}
                            </div>

                            {/* BOM Editor Panel for Menu Item */}
                            {editingBomMenuId === menu.id && (
                              <div className="p-2 bg-slate-900/90 border border-amber-900/40 rounded space-y-1.5 mt-2">
                                <span className="text-[9px] font-bold text-amber-400 block">+ Tambah Komponen Bahan Ke Resep</span>
                                <div className="grid grid-cols-12 gap-1.5">
                                  <select
                                    value={selectedBomIngId}
                                    onChange={(e) => setSelectedBomIngId(e.target.value)}
                                    className="col-span-6 bg-slate-950 border border-slate-800 text-[10px] text-slate-200 p-1 rounded"
                                  >
                                    <option value="">-- Pilih Bahan --</option>
                                    {ingredients.map(i => (
                                      <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                                    ))}
                                  </select>
                                  <input
                                    type="number"
                                    placeholder="Qty"
                                    value={bomIngQty}
                                    onChange={(e) => setBomIngQty(e.target.value)}
                                    className="col-span-3 bg-slate-950 border border-slate-800 text-[10px] text-slate-200 p-1 rounded"
                                  />
                                  <button
                                    onClick={() => handleAddBomItem(menu.id)}
                                    className="col-span-3 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded p-1"
                                  >
                                    + Tambah
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                      <span className="text-xs font-black tracking-wider uppercase text-slate-200 flex items-center gap-1.5">
                        <Clock size={14} className="text-amber-500" /> Riwayat Mutasi Stok
                      </span>
                      
                      <div className="space-y-2.5 max-h-[140px] overflow-y-auto text-[11px] pr-1">
                        {inventoryLogs.map((log, i) => (
                          <div key={i} className="flex justify-between items-start border-b border-slate-855 pb-2">
                            <div>
                              <p className="font-bold text-slate-200 leading-snug">{log.item}</p>
                              <p className="text-[10px] text-slate-500">{log.change}</p>
                            </div>
                            <div className="text-right">
                              <span className={`inline-block px-1.5 py-0.5 text-[9px] font-black rounded ${log.type === "Sales" ? "bg-emerald-950/40 text-emerald-400" : "bg-red-950/40 text-red-400"}`}>
                                {log.type}
                              </span>
                              <p className="text-[9px] text-slate-600 font-bold">{log.time}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* PRICING PLANS */}
      <section id="pricing" className="py-24 border-t border-amber-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="max-w-2xl mx-auto mb-16">
            <span className="text-amber-600 font-bold uppercase tracking-wider text-xs block">Harga Transparan</span>
            <h2 className="font-display text-4xl font-extrabold text-slate-900 mt-2">Didesain untuk Semua Skala Bisnis F&B</h2>
            <p className="text-slate-500 mt-3 text-sm md:text-base">
              Mulai dengan trial gratis 14 hari, lalu tingkatkan paket sesuai pertumbuhan meja dan stasiun dapur Anda.
            </p>
          </div>

          <div className="grid md:grid-cols-3 xl:grid-cols-5 gap-6">
            <div className="border border-slate-100 rounded-2xl p-6 bg-[hsl(36_17%_99%)] flex flex-col justify-between hover:shadow-md transition-shadow text-left">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Free Trial</span>
                <h3 className="font-display text-xl font-bold text-slate-900 mt-3">Trial 14 Hari</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-900">Rp 0</span>
                </div>
                <ul className="text-xs text-slate-500 space-y-2 mt-6">
                  <li className="flex items-center gap-1.5"><Check size={14} className="text-amber-600" /> Max 10 Meja (1 Lantai)</li>
                  <li className="flex items-center gap-1.5"><Check size={14} className="text-amber-600" /> 1 KDS Station (Dapur)</li>
                  <li className="flex items-center gap-1.5"><Check size={14} className="text-amber-600" /> Standard QR Self-Order</li>
                </ul>
              </div>
              <a href="https://wa.me/628999155182" className="btn-outline border-amber-200 text-amber-700 w-full text-xs font-bold py-2 mt-8 rounded-lg text-center block">Coba Gratis</a>
            </div>

            <div className="border border-slate-100 rounded-2xl p-6 bg-[hsl(36_17%_99%)] flex flex-col justify-between hover:shadow-md transition-shadow text-left">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Starter</span>
                <h3 className="font-display text-xl font-bold text-slate-900 mt-3">Starter POS</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-900">Rp 150rb</span>
                  <span className="text-[10px] text-slate-400 font-bold">/ bln</span>
                </div>
                <ul className="text-xs text-slate-500 space-y-2 mt-6">
                  <li className="flex items-center gap-1.5"><Check size={14} className="text-amber-600" /> Max 20 Meja (1 Lantai)</li>
                  <li className="flex items-center gap-1.5"><Check size={14} className="text-amber-600" /> 1 KDS Station</li>
                  <li className="flex items-center gap-1.5"><Check size={14} className="text-amber-600" /> Basic Recipe BOM</li>
                  <li className="flex items-center gap-1.5"><Check size={14} className="text-amber-600" /> QR Self-Order</li>
                </ul>
              </div>
              <a href="https://wa.me/628999155182" className="btn-outline border-amber-200 text-amber-700 w-full text-xs font-bold py-2 mt-8 rounded-lg text-center block">Pilih Starter</a>
            </div>

            <div className="border-2 border-amber-600 rounded-2xl p-6 bg-white flex flex-col justify-between shadow-lg relative transform lg:-translate-y-2 text-left">
              <span className="absolute top-4 right-4 text-[9px] uppercase font-bold text-white bg-amber-600 px-2.5 py-0.5 rounded-full">Terpopuler</span>
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded">Professional</span>
                <h3 className="font-display text-xl font-bold text-slate-900 mt-3">DapurOS Pro</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-900">Rp 350rb</span>
                  <span className="text-[10px] text-slate-400 font-bold">/ bln</span>
                </div>
                <ul className="text-xs text-slate-500 space-y-2 mt-6">
                  <li className="flex items-center gap-1.5"><Check size={14} className="text-amber-600" /> Meja & Lantai Unlimited</li>
                  <li className="flex items-center gap-1.5"><Check size={14} className="text-amber-600" /> Up to 3 KDS Station</li>
                  <li className="flex items-center gap-1.5"><Check size={14} className="text-amber-600" /> Full BOM Inventory</li>
                  <li className="flex items-center gap-1.5"><Check size={14} className="text-amber-600" /> EDC Payment Sync</li>
                  <li className="flex items-center gap-1.5"><Check size={14} className="text-amber-600" /> QR Self-Order</li>
                </ul>
              </div>
              <a href="https://wa.me/628999155182" className="bg-amber-600 hover:bg-amber-700 text-white w-full text-xs font-black py-2.5 mt-8 rounded-lg text-center block shadow-md shadow-amber-600/20">Pilih Pro</a>
            </div>

            <div className="border border-slate-100 rounded-2xl p-6 bg-[hsl(36_17%_99%)] flex flex-col justify-between hover:shadow-md transition-shadow text-left">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Enterprise</span>
                <h3 className="font-display text-xl font-bold text-slate-900 mt-3">Business</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-900">Rp 650rb</span>
                  <span className="text-[10px] text-slate-400 font-bold">/ bln</span>
                </div>
                <ul className="text-xs text-slate-500 space-y-2 mt-6">
                  <li className="flex items-center gap-1.5"><Check size={14} className="text-amber-600" /> Unlimited Meja / Lantai</li>
                  <li className="flex items-center gap-1.5"><Check size={14} className="text-amber-600" /> Up to 6 KDS Station</li>
                  <li className="flex items-center gap-1.5"><Check size={14} className="text-amber-600" /> Grab/Gojek API Integration</li>
                  <li className="flex items-center gap-1.5"><Check size={14} className="text-amber-600" /> Tablet Kiosk Tabletop</li>
                  <li className="flex items-center gap-1.5"><Check size={14} className="text-amber-600" /> Multi-Branch (Up to 3)</li>
                </ul>
              </div>
              <a href="https://wa.me/628999155182" className="btn-outline border-amber-200 text-amber-700 w-full text-xs font-bold py-2 mt-8 rounded-lg text-center block">Pilih Business</a>
            </div>

            <div className="border border-slate-100 rounded-2xl p-6 bg-[hsl(36_17%_99%)] flex flex-col justify-between hover:shadow-md transition-shadow text-left">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Multi-Branch</span>
                <h3 className="font-display text-xl font-bold text-slate-900 mt-3">Multi HQ Plan</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-900">Rp 1.5jt</span>
                  <span className="text-[10px] text-slate-400 font-bold">/ bln</span>
                </div>
                <ul className="text-xs text-slate-500 space-y-2 mt-6">
                  <li className="flex items-center gap-1.5"><Check size={14} className="text-amber-600" /> Unlimited Branches</li>
                  <li className="flex items-center gap-1.5"><Check size={14} className="text-amber-600" /> Central Commissary Kitchen</li>
                  <li className="flex items-center gap-1.5"><Check size={14} className="text-amber-600" /> Raw Materials stock transfer</li>
                  <li className="flex items-center gap-1.5"><Check size={14} className="text-amber-600" /> Advanced HQ CRM</li>
                  <li className="flex items-center gap-1.5"><Check size={14} className="text-amber-600" /> Dedicated Account Manager</li>
                </ul>
              </div>
              <a href="https://wa.me/628999155182" className="btn-outline border-amber-200 text-amber-700 w-full text-xs font-bold py-2 mt-8 rounded-lg text-center block">Pilih HQ Plan</a>
            </div>
          </div>

          <div className="mt-12 p-6 bg-amber-50/50 border border-amber-100 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 text-left">
            <div>
              <h4 className="font-display font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Percent size={16} className="text-amber-600" /> Memerlukan Perangkat Kustom Tambahan?
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                Kami menyediakan lisensi printer kasir thermal tambahan (Rp 50rb/bln), Tablet Order Tabletop (Rp 25rb/tablet/bln), dan integrasi API Grab/Gojek (Rp 100rb/bln).
              </p>
            </div>
            <a href="https://wa.me/628999155182?text=Halo%20DagangOS%20saya%20tertarik%20tanya%20mengenai%20addon%20DapurOS." target="_blank" rel="noopener noreferrer" className="btn-primary text-xs bg-amber-600 hover:bg-amber-700 border-amber-600 shrink-0 font-extrabold rounded-lg">Konsultasi Add-on</a>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faq" className="py-20 border-t border-amber-100 bg-white/40">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-amber-600 font-bold uppercase tracking-wider text-xs block">Pertanyaan Umum</span>
            <h2 className="font-display text-4xl font-extrabold text-slate-900 mt-2">Masih Memiliki Pertanyaan?</h2>
            <p className="text-slate-500 mt-3 text-sm">
              Berikut jawaban atas pertanyaan operasional restoran/kafe yang sering kami temukan.
            </p>
          </div>

          <div className="space-y-4">
            <FaqItem
              q="Apakah DapurOS tetap bisa digunakan jika koneksi internet mati?"
              a="Ya. DapurOS memiliki fitur Offline Tolerance. POS kasir dapat terus menerima pesanan dan menahan antrean meja. Semua data transaksi dicatat di penyimpanan lokal perangkat dan akan disinkronisasikan otomatis ke Vercel/Cloudflare begitu internet kembali aktif."
            />
            <FaqItem
              q="Bagaimana cara kerja Recipe BOM memotong stok bahan mentah?"
              a="Anda dapat mendefinisikan resep untuk setiap menu. Misalnya, 1 gelas Es Kopi Susu Aren menggunakan 18g biji kopi dan 120ml fresh milk. Begitu pesanan diselesaikan (Paid) di kasir POS atau diselesaikan lewat QR self-order, sistem backend langsung mengurangi stok biji kopi dan susu di inventory secara real-time."
            />
            <FaqItem
              q="Apakah saya harus menyewa tablet khusus untuk KDS Dapur?"
              a="Tidak wajib. DapurOS dirancang responsif dan kompatibel dengan browser modern. Anda dapat menggunakan tablet Android, iPad, atau Smart TV murah apa pun yang terhubung ke jaringan internet lokal."
            />
            <FaqItem
              q="Apakah pembayaran QRIS pelanggan langsung ter-settle secara real-time?"
              a="Benar. DapurOS terintegrasi langsung dengan Xendit. Begitu pelanggan membayar dinamis QRIS di meja mereka, Webhook Xendit akan mengirim notifikasi ke server Vercel kami dalam 1-2 detik, yang secara instan merubah status meja menjadi 'Paid/Vacant' di monitor POS kasir via WebSockets."
            />
            <FaqItem
              q="Bagaimana alur koordinasi pengantaran pesanan oleh Waiter?"
              a="Ketika chef menyelesaikan pesanan di KDS dapur dan menekan 'Siap Sajikan', layar monitor kasir dan notifikasi HP waiter akan berkedip hijau menandakan menu tersebut siap diambil di meja saji (pass shelf). Waiter mengantarkannya dan menekan 'Telah Disajikan' untuk melengkapi siklus pesanan."
            />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 border-t border-amber-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-xs text-[hsl(var(--muted))] gap-6">
          <div className="flex items-center gap-2 font-display text-sm font-bold text-amber-700">
            <Utensils className="text-amber-600" size={16} />
            <span>DapurOS by DagangOS Suite</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-[11px] font-semibold">
            <button 
              onClick={() => setIsTermsOpen(true)} 
              className="hover:text-[hsl(var(--foreground))] transition-colors"
            >
              Syarat & Ketentuan
            </button>
            <a 
              href="https://wa.me/628999155182?text=Halo%20DagangOS%20saya%20ingin%20tanya%20mengenai%20DapurOS." 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-amber-700 hover:text-amber-800 transition-colors font-bold"
            >
              Hubungi Sales F&B (WhatsApp)
            </a>
          </div>
          <div>
            © 2026 DagangOS. All rights reserved. Registered under Vercel & Cloudflare deployment.
          </div>
        </div>
      </footer>

      {/* Syarat & Ketentuan Modal */}
      {isTermsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-amber-100 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-fadein">
            <div className="px-6 py-4 border-b border-amber-100 flex items-center justify-between bg-amber-50/50">
              <div className="flex items-center gap-2">
                <Utensils className="text-amber-600" size={18} />
                <h3 className="font-display font-bold text-base text-amber-800">Syarat & Ketentuan Penggunaan DapurOS</h3>
              </div>
              <button onClick={() => setIsTermsOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors font-bold">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-500 leading-relaxed text-left">
              <section className="space-y-1">
                <h4 className="font-bold text-slate-800 text-sm">1. Ruang Lingkup Layanan DapurOS</h4>
                <p>DapurOS menyediakan modul khusus Point of Sale (POS) F&B, Kitchen Display System (KDS), QR Self-Ordering digital menu, and Recipe BOM tracking. Seluruh transaksi data tersinkronisasi via cloud hosting Vercel & Cloudflare.</p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-slate-800 text-sm">2. Tanggung Jawab Integrasi Perangkat Keras</h4>
                <p>Konektivitas printer thermal lokal (ESC/POS) dan fungsionalitas mesin EDC pihak ketiga bergantung pada stabilitas router LAN lokal milik merchant. DagangOS tidak menjamin kelancaran offline mode jika infrastruktur WiFi internal merchant bermasalah.</p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-slate-800 text-sm">3. Akurasi HPP & Stok Resep</h4>
                <p>Keakuratan pemotongan inventory bergantung sepenuhnya pada input Bill of Materials (BOM) oleh pengelola restoran. Selisih/variance stok fisik dengan stok digital akibat spoilage tak tercatat di luar tanggung jawab DagangOS.</p>
              </section>
            </div>

            <div className="px-6 py-4 border-t border-amber-100 flex justify-end bg-amber-50/50">
              <button onClick={() => setIsTermsOpen(false)} className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-lg">Saya Mengerti</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FaqItem({ q, a }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border border-slate-100 rounded-xl bg-white overflow-hidden shadow-sm transition-all text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 text-left flex items-center justify-between font-display font-bold text-sm text-slate-800 hover:text-amber-700 transition-colors"
      >
        <span>{q}</span>
        {isOpen ? <ChevronUp size={16} className="text-amber-600" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {isOpen && (
        <div className="px-6 pb-4 text-xs text-slate-500 leading-relaxed border-t border-slate-50/50 pt-2 bg-slate-50/30 text-left">
          {a}
        </div>
      )}
    </div>
  );
}
