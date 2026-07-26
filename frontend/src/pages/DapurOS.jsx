import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  ChefHat,
  CheckCircle2,
  ClipboardList,
  CookingPot,
  LayoutGrid,
  Package,
  QrCode,
  ReceiptText,
  TabletSmartphone,
  Warehouse,
} from "lucide-react";

const ACCENT = "#ff7518";
const ACCENT_2 = "#e85f08";
const BG = "#0b0502";
const LINE = "rgba(255,133,47,.18)";
const TEXT = "#fff9f4";
const MUTED = "#b3a094";
const READY = "#22c55e";
const JK = "'Plus Jakarta Sans', 'Figtree', sans-serif";

const FEATURES = [
  { icon: TabletSmartphone, title: "POS Restoran", text: "Kelola transaksi, menu, pesanan, diskon, pajak, dan pembayaran dalam antarmuka operasional restoran." },
  { icon: ChefHat, title: "Kitchen Display System", text: "Pesanan masuk ke layar dapur agar tim dapat melihat antrean, status, dan proses penyajian." },
  { icon: QrCode, title: "QR Self Ordering", text: "Sediakan alur pemesanan mandiri melalui menu digital dan kode QR meja." },
  { icon: LayoutGrid, title: "Manajemen Meja", text: "Atur meja, area, status penggunaan, dan perpindahan pesanan sesuai operasional restoran." },
  { icon: Package, title: "Resep & Inventori Bahan", text: "Hubungkan menu dengan resep dan bahan baku untuk membantu pencatatan pemakaian inventori." },
  { icon: BarChart3, title: "Laporan Operasional", text: "Tinjau transaksi, menu, aktivitas dapur, inventori, dan data operasional dari sistem yang sama." },
];

const QUICK_FEATURES = [
  { icon: TabletSmartphone, label: "POS" },
  { icon: ChefHat, label: "KDS" },
  { icon: QrCode, label: "QR Order" },
  { icon: LayoutGrid, label: "Meja" },
  { icon: Warehouse, label: "Bahan" },
  { icon: BarChart3, label: "Laporan" },
];

function Nav({ user }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="neo-nav" data-testid="landing-nav">
      <div className="neo-shell neo-nav-inner">
        <Link to="/dapuros" className="neo-brand" data-testid="landing-logo">
          <img src="/assets/brand/dapuros-icon.png" alt="" />
          <span>Dapur<span>OS</span></span>
        </Link>
        <nav className="neo-links" aria-label="Navigasi DapurOS">
          <a href="#fitur">Fitur</a>
          <a href="#solusi">Solusi</a>
          <Link to="/dapuros/pricing">Harga</Link>
          <a href="/">Ekosistem</a>
          <a href="#footer">Sumber Daya</a>
        </nav>
        <div className="neo-actions">
          {user ? (
            <Link to="/dapuros/app/dashboard" className="neo-button neo-primary" data-testid="nav-dashboard-btn">Buka Dashboard</Link>
          ) : (
            <>
              <Link to="/dapuros/login" className="neo-button" data-testid="nav-login-btn">Masuk</Link>
              <Link to="/dapuros/register" className="neo-button neo-primary" data-testid="nav-register-btn">Mulai Gratis</Link>
            </>
          )}
          <button className="neo-menu" type="button" aria-label="Buka menu" onClick={() => setOpen((value) => !value)}>☰</button>
        </div>
      </div>
      <div className={`neo-mobile ${open ? "is-open" : ""}`}>
        <a href="#fitur" onClick={() => setOpen(false)}>Fitur</a>
        <a href="#solusi" onClick={() => setOpen(false)}>Solusi</a>
        <Link to="/dapuros/pricing" onClick={() => setOpen(false)}>Harga</Link>
        <a href="/">Ekosistem DagangOS</a>
      </div>
    </header>
  );
}

function TiltWrap({ children }) {
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const move = (event) => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    setTilt({ ry: (px - 0.5) * 9, rx: (0.5 - py) * 7 });
  };
  return (
    <div onMouseMove={move} onMouseLeave={() => setTilt({ rx: 0, ry: 0 })} style={{ transform: `perspective(1100px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`, transition: "transform .28s ease", transformStyle: "preserve-3d" }}>
      {children}
    </div>
  );
}

function KitchenVisual() {
  const tickets = [
    { id: "#1024", name: "Ayam Bakar", status: "BARU", color: ACCENT },
    { id: "#1025", name: "Nasi Goreng", status: "PROSES", color: "#f3b832" },
    { id: "#1026", name: "Soto Ayam", status: "SIAP", color: READY },
  ];
  return (
    <div className="kitchen-stage">
      <div className="kitchen-glow" />
      <div className="kds-screen">
        <div className="kds-bar"><span /><span /><span /><b>DapurOS · Kitchen Display</b></div>
        <div className="kds-columns">{tickets.map((ticket) => <div key={ticket.id} className="kds-ticket"><small style={{ color: ticket.color }}>{ticket.status}</small><strong>{ticket.id}</strong><span>{ticket.name}</span><i style={{ background: ticket.color }} /></div>)}</div>
      </div>
      <div className="pos-terminal">
        <div className="terminal-top"><img src="/assets/brand/dapuros-icon.png" alt="" /><b>Pesanan</b><span>Meja 04</span></div>
        <div className="terminal-menu"><div><i>🍗</i><b>Ayam Bakar</b><small>Rp 35.000</small></div><div><i>🍜</i><b>Nasi Goreng</b><small>Rp 30.000</small></div><div><i>☕</i><b>Kopi Susu</b><small>Rp 18.000</small></div><div><i>🥤</i><b>Es Teh</b><small>Rp 10.000</small></div></div>
        <div className="terminal-total"><span>Total</span><strong>Rp 93.000</strong><button type="button">Bayar</button></div>
      </div>
      <div className="order-phone"><small>Pesanan Dikirim</small><div className="order-step done"><CheckCircle2 size={14} />Diterima</div><div className="order-step active"><CookingPot size={14} />Diproses</div><div className="order-step"><BellRing size={14} />Siap Disajikan</div></div>
      <div className="receipt-printer"><ReceiptText size={34} /><i /></div>
      <div className="service-bell"><BellRing size={39} /></div>
      <div className="floating-panel station-panel"><ChefHat size={20} /><div><small>Dapur</small><b>Antrean pesanan</b></div></div>
      <div className="floating-panel table-panel"><LayoutGrid size={20} /><div><small>Meja</small><b>Status operasional</b></div></div>
    </div>
  );
}

function RestaurantFeatureScene({ index }) {
  if (index === 0) {
    return <div className="feature-sim kitchen-pos-sim" aria-label="Simulasi POS restoran">
      <div className="menu-grid">{["Ayam bakar", "Nasi goreng", "Kopi susu", "Es teh"].map((item, itemIndex) => <span key={item} style={{ "--delay": `${itemIndex * 0.18}s` }}><i>{itemIndex % 2 ? "●" : "◆"}</i><b>{item}</b><small>Tambah +</small></span>)}</div>
      <div className="order-bill"><small>MEJA 04</small><b>3 pesanan</b><div><span>Total</span><strong>Rp 93.000</strong></div><button type="button">Kirim &amp; Bayar</button></div>
      <i className="order-sweep" />
    </div>;
  }
  if (index === 1) {
    return <div className="feature-sim kds-sim" aria-label="Simulasi kitchen display">
      {[
        ["BARU", "#1024", "Ayam bakar", "00:18"],
        ["PROSES", "#1025", "Nasi goreng", "04:32"],
        ["SIAP", "#1026", "Soto ayam", "07:10"],
      ].map((ticket, itemIndex) => <div className={`kds-sim-ticket ticket-${itemIndex}`} key={ticket[1]}><small>{ticket[0]}</small><strong>{ticket[1]}</strong><b>{ticket[2]}</b><span>{ticket[3]}</span><i /></div>)}
      <span className="ticket-runner" />
    </div>;
  }
  if (index === 2) {
    return <div className="feature-sim qr-sim" aria-label="Simulasi QR self ordering">
      <div className="qr-phone"><i className="qr-code">{[0,1,2,3,4,5,6,7,8].map((cell) => <span key={cell} />)}</i><b>Scan menu meja</b><small>Meja 08</small></div>
      <div className="qr-flow"><span><i>1</i><b>Pilih menu</b></span><span><i>2</i><b>Kirim pesanan</b></span><span><i>3</i><b>Dapur menerima</b></span><em /></div>
    </div>;
  }
  if (index === 3) {
    return <div className="feature-sim table-sim" aria-label="Simulasi manajemen meja">
      <div className="floor-label"><b>Denah ruang utama</b><span><i />Kosong</span><span><i />Terisi</span></div>
      <div className="floor-plan">{["01", "02", "03", "04", "05", "06", "07", "08"].map((table, itemIndex) => <button type="button" key={table} className={itemIndex % 3 === 1 || itemIndex === 6 ? "occupied" : ""} style={{ "--delay": `${itemIndex * .1}s` }}><i /><b>{table}</b><small>{itemIndex % 3 === 1 || itemIndex === 6 ? "Terisi" : "Kosong"}</small></button>)}</div>
      <span className="floor-pulse" />
    </div>;
  }
  if (index === 4) {
    return <div className="feature-sim recipe-sim" aria-label="Simulasi resep dan bahan">
      <div className="dish-core"><CookingPot size={28} /><b>Nasi goreng</b><small>1 porsi</small></div>
      {["Nasi", "Telur", "Bumbu", "Minyak"].map((ingredient, itemIndex) => <div className={`ingredient ingredient-${itemIndex}`} key={ingredient}><i /><b>{ingredient}</b><small>{[150, 1, 12, 8][itemIndex]} {itemIndex === 1 ? "butir" : "gr"}</small></div>)}
      <span className="recipe-orbit" /><span className="recipe-packet" />
    </div>;
  }
  return <div className="feature-sim ops-report-sim" aria-label="Simulasi laporan operasional">
    <div className="ops-summary"><small>OPERASIONAL</small><b>Ringkasan aktivitas</b><span>Transaksi, menu, dapur, dan bahan</span></div>
    <div className="ops-radar"><i /><i /><i /><i /><span /></div>
    <div className="ops-stream">{["Kasir", "KDS", "Bahan", "Laporan"].map((label, itemIndex) => <span key={label} style={{ "--delay": `${itemIndex * .2}s` }}><i />{label}<b>{itemIndex + 1}</b></span>)}</div>
  </div>;
}

export default function DapurOS() {
  const { user } = useAuth();
  const [activeFeature, setActiveFeature] = useState(0);
  const selectedFeature = FEATURES[activeFeature];
  const SelectedFeatureIcon = selectedFeature.icon;

  useEffect(() => {
    const token = localStorage.getItem("dagangos_token") || localStorage.getItem("geraina_token") || localStorage.getItem("dapuros_token");
    if (user || token) window.location.replace("/dapuros/app/dashboard");
  }, [user]);

  return (
    <div className="neo-page">
      <style>{`
        .neo-page{min-height:100vh;background:${BG};color:${TEXT};font-family:Inter,system-ui,sans-serif;overflow:hidden}.neo-page *{box-sizing:border-box}.neo-page a{text-decoration:none;color:inherit}.neo-page button{font:inherit}.neo-page img{display:block;max-width:100%}
        .neo-page:before{content:"";position:fixed;inset:0;pointer-events:none;background:radial-gradient(circle at 76% 12%,rgba(255,117,24,.15),transparent 34rem),radial-gradient(circle at 15% 42%,rgba(30,124,255,.07),transparent 30rem),linear-gradient(rgba(255,117,24,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,117,24,.025) 1px,transparent 1px);background-size:auto,auto,42px 42px,42px 42px;mask-image:linear-gradient(to bottom,#000,transparent 90%)}
        .neo-shell{width:min(1220px,calc(100% - 40px));margin:auto}.neo-nav{position:sticky;top:0;z-index:50;border-bottom:1px solid ${LINE};background:rgba(11,5,2,.84);backdrop-filter:blur(20px)}.neo-nav-inner{height:70px;display:flex;align-items:center;justify-content:space-between;gap:24px}.neo-brand{display:flex;align-items:center;gap:10px;font:800 20px ${JK}}.neo-brand img{width:38px;height:38px;object-fit:contain;filter:drop-shadow(0 0 14px rgba(255,117,24,.36))}.neo-brand>span>span{color:${ACCENT}}.neo-links{display:flex;align-items:center;gap:27px;color:#c9b7aa;font-size:13px;font-weight:600}.neo-links a:hover{color:white}.neo-actions{display:flex;align-items:center;gap:9px}.neo-button{border:1px solid ${LINE};border-radius:10px;padding:10px 15px;font-size:13px;font-weight:700;color:white;background:rgba(255,255,255,.025);transition:.2s}.neo-button:hover{transform:translateY(-2px);border-color:rgba(255,117,24,.45)}.neo-primary{border-color:transparent;background:linear-gradient(135deg,${ACCENT_2},${ACCENT});box-shadow:0 8px 24px rgba(232,95,8,.25);color:#260d00}.neo-menu{display:none;background:none;border:1px solid ${LINE};color:white;border-radius:9px;width:40px;height:40px}.neo-mobile{display:none;width:min(1220px,calc(100% - 40px));margin:auto;padding:8px 0 18px}.neo-mobile.is-open{display:grid}.neo-mobile a{padding:11px 0;color:#c9b7aa}
        .neo-hero{width:min(1220px,calc(100% - 40px));margin:auto;min-height:680px;display:grid;grid-template-columns:.88fr 1.12fr;align-items:center;gap:42px;padding:64px 0 44px;position:relative}.neo-copy{position:relative;z-index:2}.neo-kicker{display:inline-flex;gap:8px;align-items:center;border:1px solid rgba(255,117,24,.34);border-radius:999px;padding:7px 11px;background:rgba(46,19,5,.72);color:#ffd6ba;font-size:12px}.neo-kicker:before{content:"";width:7px;height:7px;border-radius:50%;background:${ACCENT};box-shadow:0 0 14px ${ACCENT}}.neo-title{font:800 clamp(42px,5.7vw,70px)/1.04 ${JK};letter-spacing:-.055em;margin:23px 0 18px}.neo-title span{background:linear-gradient(90deg,${ACCENT},#ff9a3d);-webkit-background-clip:text;color:transparent}.neo-lead{max-width:560px;color:#b8a497;font-size:16px;line-height:1.78;margin:0}.neo-cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}.neo-cta .neo-button{padding:13px 20px;font-size:14px}.neo-checks{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:34px}.neo-check{border-top:1px solid ${LINE};padding-top:15px;color:#9b8779;font-size:11px;line-height:1.45}.neo-check b{display:flex;align-items:center;gap:7px;color:#fff8f2;font-size:13px;margin-bottom:4px}.neo-check svg{color:${ACCENT}}
        .kitchen-stage{height:560px;position:relative;transform-style:preserve-3d}.kitchen-glow{position:absolute;inset:18% 3% 5%;border-radius:50%;background:radial-gradient(circle,rgba(255,117,24,.2),transparent 62%);filter:blur(15px)}.kds-screen{position:absolute;right:4%;top:4%;width:66%;border:1px solid rgba(255,134,52,.38);background:#130902;border-radius:19px;overflow:hidden;box-shadow:0 34px 86px rgba(0,0,0,.5),0 0 46px rgba(255,117,24,.2);transform:rotateY(-7deg)}.kds-bar{height:36px;display:flex;align-items:center;gap:7px;padding:0 13px;border-bottom:1px solid ${LINE};background:#1c0d04}.kds-bar span{width:8px;height:8px;border-radius:50%;background:#5a2c10}.kds-bar b{font-size:10px;margin-left:6px;color:#e2c5b1}.kds-columns{display:grid;grid-template-columns:repeat(3,1fr);min-height:170px}.kds-ticket{padding:15px;border-right:1px solid ${LINE};position:relative}.kds-ticket:last-child{border-right:0}.kds-ticket small,.kds-ticket strong,.kds-ticket span{display:block}.kds-ticket small{font-size:8px;font-weight:800}.kds-ticket strong{font:700 12px ${JK};margin:10px 0 4px}.kds-ticket span{font-size:9px;color:#b59e8d}.kds-ticket i{position:absolute;left:15px;right:15px;bottom:14px;height:2px;border-radius:10px;box-shadow:0 0 9px currentColor}.pos-terminal{position:absolute;left:7%;bottom:8%;width:59%;border:1px solid rgba(255,133,47,.4);background:#160a03;border-radius:21px;padding:17px;box-shadow:0 35px 84px rgba(0,0,0,.48),0 0 46px rgba(255,117,24,.18);transform:rotateY(7deg) rotateX(2deg)}.terminal-top{display:flex;align-items:center;gap:9px;padding-bottom:12px;border-bottom:1px solid ${LINE}}.terminal-top img{width:26px;height:26px}.terminal-top b{font:700 12px ${JK}}.terminal-top span{margin-left:auto;color:#a48774;font-size:9px}.terminal-menu{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:13px}.terminal-menu>div{padding:8px;border:1px solid ${LINE};border-radius:9px;background:#100701}.terminal-menu i,.terminal-menu b,.terminal-menu small{display:block}.terminal-menu i{font-style:normal;font-size:19px}.terminal-menu b{font-size:7px;margin:6px 0 3px}.terminal-menu small{font-size:6px;color:#a68c7a}.terminal-total{display:flex;align-items:center;gap:11px;margin-top:13px}.terminal-total span{font-size:8px;color:#9d8473}.terminal-total strong{font:800 14px ${JK};color:${ACCENT}}.terminal-total button{margin-left:auto;border:0;background:${ACCENT};color:#2e0e00;border-radius:8px;padding:8px 15px;font-size:8px;font-weight:800}.order-phone{position:absolute;right:2%;bottom:7%;width:128px;min-height:228px;border:1px solid rgba(255,133,47,.4);border-radius:24px;background:#110802;padding:18px 12px;box-shadow:0 24px 55px rgba(0,0,0,.48),0 0 30px rgba(255,117,24,.14);transform:rotate(7deg)}.order-phone>small{font-weight:800;color:white}.order-step{display:flex;align-items:center;gap:7px;margin-top:24px;color:#8d7667;font-size:8px}.order-step.done{color:${READY}}.order-step.active{color:${ACCENT}}.receipt-printer,.service-bell{position:absolute;display:grid;place-items:center;color:${ACCENT};border:1px solid rgba(255,133,47,.42);background:linear-gradient(145deg,#1e0e05,#080301);box-shadow:0 18px 36px rgba(0,0,0,.38),0 0 26px rgba(255,117,24,.14)}.receipt-printer{left:48%;bottom:1%;width:110px;height:82px;border-radius:17px}.receipt-printer i{width:55px;height:24px;border-top:5px solid #e3c7b4;background:repeating-linear-gradient(#b8957c 0 2px,transparent 2px 5px)}.service-bell{left:67%;bottom:0;width:82px;height:59px;border-radius:45px 45px 13px 13px}.floating-panel{position:absolute;display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid rgba(255,133,47,.34);border-radius:13px;background:rgba(38,15,3,.91);box-shadow:0 14px 32px rgba(0,0,0,.34),0 0 22px rgba(255,117,24,.12);color:${ACCENT}}.floating-panel small,.floating-panel b{display:block}.floating-panel small{font-size:8px;color:#a58b79}.floating-panel b{font-size:10px;color:white;margin-top:2px}.station-panel{left:1%;top:4%}.table-panel{right:0;top:39%}
        .neo-strip{border-top:1px solid ${LINE};border-bottom:1px solid ${LINE};background:rgba(26,10,2,.74)}.neo-strip-inner{width:min(1220px,calc(100% - 40px));margin:auto;display:grid;grid-template-columns:repeat(6,1fr)}.neo-strip-item{padding:18px 10px;border-right:1px solid ${LINE};display:flex;align-items:center;justify-content:center;gap:8px;color:#b6a092;font-size:11px}.neo-strip-item:last-child{border-right:0}.neo-strip-item svg{color:${ACCENT}}
        .neo-section{width:min(1220px,calc(100% - 40px));margin:auto;padding:88px 0}.neo-section-head{display:flex;align-items:end;justify-content:space-between;gap:30px;margin-bottom:32px}.neo-section-head small{color:${ACCENT};font-weight:800;letter-spacing:.16em;text-transform:uppercase}.neo-section-head h2{font:800 clamp(30px,4vw,46px)/1.1 ${JK};letter-spacing:-.04em;margin:9px 0 0}.neo-section-head p{max-width:480px;color:${MUTED};line-height:1.65;margin:0;font-size:14px}.neo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.neo-card{position:relative;overflow:hidden;min-height:220px;padding:22px;border:1px solid ${LINE};border-radius:19px;background:linear-gradient(150deg,rgba(43,17,3,.93),rgba(15,6,2,.94));transition:.25s}.neo-card:hover{transform:translateY(-6px);border-color:rgba(255,117,24,.44);box-shadow:0 22px 50px rgba(0,0,0,.34),0 0 30px rgba(255,117,24,.08)}.neo-card:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 100% 0%,rgba(255,117,24,.15),transparent 48%)}.neo-card svg{position:relative;color:${ACCENT}}.neo-card h3{position:relative;font:800 18px ${JK};margin:26px 0 9px}.neo-card p{position:relative;color:${MUTED};font-size:13px;line-height:1.65;margin:0}.neo-solution{border:1px solid ${LINE};border-radius:25px;background:linear-gradient(135deg,rgba(42,16,3,.92),rgba(14,5,1,.95));padding:36px;display:grid;grid-template-columns:.8fr 1.2fr;gap:32px;align-items:center}.neo-solution-copy h2{font:800 38px/1.14 ${JK};letter-spacing:-.04em;margin:0 0 14px}.neo-solution-copy p{color:${MUTED};line-height:1.75;margin:0}.neo-flow{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.neo-flow>div{padding:17px;border:1px solid ${LINE};border-radius:15px;background:rgba(14,5,1,.68)}.neo-flow svg{color:${ACCENT};margin-bottom:18px}.neo-flow b{display:block;font:700 13px ${JK};margin-bottom:5px}.neo-flow span{color:${MUTED};font-size:10px;line-height:1.5}.neo-cta-panel{width:min(1220px,calc(100% - 40px));margin:0 auto 88px;border:1px solid rgba(255,117,24,.27);border-radius:24px;padding:42px;background:radial-gradient(circle at 80% 40%,rgba(255,117,24,.15),transparent 34%),linear-gradient(135deg,#2a1003,#100501);display:flex;justify-content:space-between;align-items:center;gap:28px}.neo-cta-panel h2{font:800 34px/1.15 ${JK};margin:0 0 8px}.neo-cta-panel p{color:${MUTED};margin:0}.neo-footer{border-top:1px solid ${LINE};background:#080301}.neo-footer-inner{width:min(1220px,calc(100% - 40px));margin:auto;padding:38px 0 24px;display:flex;justify-content:space-between;align-items:center;gap:24px;color:#927b6c;font-size:12px}.neo-footer-brand{display:flex;align-items:center;gap:9px}.neo-footer-brand img{width:28px;height:28px}.neo-footer-links{display:flex;gap:22px}.neo-footer a:hover{color:white}
        @media(max-width:1050px){.neo-links{display:none}.neo-menu{display:block}.neo-actions>.neo-button{display:none}.neo-hero{grid-template-columns:1fr;padding-top:70px}.neo-copy{text-align:center}.neo-lead{margin:auto}.neo-cta{justify-content:center}.neo-checks{max-width:700px;margin-left:auto;margin-right:auto}.kitchen-stage{width:min(760px,100%);margin:auto}.neo-grid{grid-template-columns:1fr 1fr}.neo-solution{grid-template-columns:1fr}}
        @media(max-width:720px){.neo-shell,.neo-hero,.neo-strip-inner,.neo-section,.neo-cta-panel,.neo-footer-inner{width:min(100% - 28px,1220px)}.neo-title{font-size:43px}.neo-checks{grid-template-columns:1fr}.kitchen-stage{height:490px;transform:scale(.82);margin:-35px auto}.neo-strip-inner{grid-template-columns:repeat(3,1fr)}.neo-strip-item:nth-child(3){border-right:0}.neo-strip-item:nth-child(-n+3){border-bottom:1px solid ${LINE}}.neo-section-head{display:block}.neo-section-head p{margin-top:16px}.neo-grid{grid-template-columns:1fr}.neo-solution{padding:24px}.neo-flow{grid-template-columns:1fr 1fr}.neo-cta-panel{display:block;text-align:center;padding:32px 22px}.neo-cta-panel .neo-cta{justify-content:center}.neo-footer-inner{display:block;text-align:center}.neo-footer-brand,.neo-footer-links{justify-content:center}.neo-footer-links{margin-top:17px}}
        @media(max-width:480px){.kitchen-stage{height:420px;transform:scale(.68);margin:-75px -21%}.neo-strip-inner{grid-template-columns:1fr 1fr}.neo-strip-item:nth-child(n){border-bottom:1px solid ${LINE}}.neo-strip-item:nth-child(2n){border-right:0}.neo-flow{grid-template-columns:1fr}.neo-footer-links{flex-wrap:wrap}}
        @media(prefers-reduced-motion:reduce){.neo-page *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
      `}</style>
      <style>{`
        .neo-workbench{display:grid;grid-template-columns:330px 1fr;min-height:470px;border-top:1px solid ${LINE};border-bottom:1px solid ${LINE}}
        .neo-feature-rail{display:flex;flex-direction:column;border-right:1px solid ${LINE}}
        .neo-feature-tab{appearance:none;border:0;border-bottom:1px solid ${LINE};background:transparent;color:#9a7b67;text-align:left;padding:20px 6px;display:grid;grid-template-columns:42px 1fr auto;align-items:center;gap:12px;cursor:pointer;transition:.22s}
        .neo-feature-tab svg{color:#805b43}.neo-feature-tab b{font:700 14px ${JK}}.neo-feature-tab span{font:800 10px ${JK};color:#68442f}
        .neo-feature-tab:hover,.neo-feature-tab.is-active{padding-left:16px;color:white;background:linear-gradient(90deg,rgba(255,117,24,.14),transparent)}
        .neo-feature-tab.is-active svg,.neo-feature-tab.is-active span{color:${ACCENT}}
        .neo-feature-stage{position:relative;overflow:hidden;padding:46px 54px;display:flex;flex-direction:column;justify-content:space-between;background:radial-gradient(circle at 80% 30%,rgba(255,117,24,.14),transparent 32rem)}
        .neo-feature-stage:before{content:"";position:absolute;inset:-40% 0 auto;height:40%;background:linear-gradient(transparent,rgba(255,117,24,.14),transparent);animation:stage-scan 4s linear infinite}
        .neo-stage-head{position:relative;display:flex;gap:20px;align-items:flex-start}.neo-stage-icon{width:68px;height:68px;display:grid;place-items:center;border:1px solid rgba(255,117,24,.4);border-radius:18px;color:${ACCENT};background:rgba(255,117,24,.09);box-shadow:0 0 36px rgba(255,117,24,.14)}
        .neo-stage-copy small{color:${ACCENT};letter-spacing:.16em;text-transform:uppercase;font-size:10px;font-weight:800}.neo-stage-copy h3{font:800 clamp(28px,4vw,46px)/1.1 ${JK};margin:9px 0 13px}.neo-stage-copy p{color:${MUTED};line-height:1.75;max-width:650px;margin:0}
        .neo-stage-visual{position:relative;height:180px;display:flex;align-items:end;gap:10px;border-bottom:1px solid ${LINE}}.neo-stage-bar{flex:1;height:calc(28px + var(--bar) * 18px);max-height:150px;background:linear-gradient(180deg,${ACCENT},rgba(255,117,24,.08));border-radius:5px 5px 0 0;transform-origin:bottom;animation:bar-rise .62s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--bar) * 55ms);box-shadow:0 0 18px rgba(255,117,24,.12)}
        .neo-stage-line{position:absolute;left:0;right:0;top:42%;height:1px;background:linear-gradient(90deg,transparent,#ffcf5a,transparent);box-shadow:0 0 12px #ffb11c}
        .neo-solution{border-radius:0;border-left:0;border-right:0;padding:42px 0;background:transparent}.neo-flow{gap:0}.neo-flow>div{position:relative;border-radius:0;border-width:0 0 0 1px;background:transparent;padding:18px 18px 18px 22px}.neo-flow>div:after{content:"";position:absolute;right:-4px;top:28px;width:7px;height:7px;border-radius:50%;background:${ACCENT};box-shadow:0 0 14px ${ACCENT}}.neo-flow>div:last-child:after{display:none}
        @keyframes stage-scan{to{transform:translateY(750px)}}@keyframes bar-rise{from{transform:scaleY(0);opacity:0}to{transform:scaleY(1);opacity:1}}
        @media(max-width:1050px){.neo-workbench{grid-template-columns:270px 1fr}}
        @media(max-width:720px){.neo-workbench{display:block}.neo-feature-rail{border-right:0;display:grid;grid-template-columns:1fr 1fr}.neo-feature-tab{padding:15px 8px;grid-template-columns:28px 1fr}.neo-feature-tab span{display:none}.neo-feature-tab:hover,.neo-feature-tab.is-active{padding-left:12px}.neo-feature-stage{min-height:420px;padding:34px 22px}.neo-stage-icon{width:54px;height:54px}}
      `}</style>
      <style>{`
        .neo-page{background:#fff8f1;color:#32180a}.neo-page:before{background:radial-gradient(circle at 76% 7%,rgba(255,117,24,.22),transparent 34rem),radial-gradient(circle at 14% 44%,rgba(255,196,83,.15),transparent 30rem),linear-gradient(rgba(114,55,18,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(114,55,18,.035) 1px,transparent 1px);background-size:auto,auto,46px 46px,46px 46px}
        .neo-nav{background:rgba(255,252,248,.84);border-color:rgba(108,51,17,.12);box-shadow:0 12px 42px rgba(110,52,17,.08)}.neo-links,.neo-mobile a{color:#715542}.neo-links a:hover{color:#32180a}.neo-button{color:#4a250f;background:rgba(255,255,255,.76);border-color:rgba(114,55,18,.15)}.neo-primary{color:#331300}.neo-menu{color:#4a250f;background:white}
        .neo-kicker{background:#fff0e3;color:#8b3c0c;border-color:rgba(224,91,8,.24)}.neo-lead,.neo-section-head p,.neo-stage-copy p,.neo-solution-copy p{color:#7c6556}.neo-check{color:#8a7161}.neo-check b{color:#4b2915}.kitchen-stage{filter:drop-shadow(0 30px 45px rgba(132,62,15,.12))}.kitchen-glow{background:radial-gradient(circle,rgba(255,117,24,.28),transparent 62%)}
        .neo-strip{background:rgba(255,255,255,.7);border-color:rgba(108,51,17,.12)}.neo-strip-item{color:#755a48;border-color:rgba(108,51,17,.12)}
        .neo-workbench{min-height:560px;border:1px solid rgba(108,51,17,.12);border-radius:30px;overflow:hidden;background:rgba(255,255,255,.75);box-shadow:0 30px 80px rgba(112,51,14,.1)}
        .neo-feature-rail{background:rgba(255,241,230,.66);border-color:rgba(108,51,17,.12)}.neo-feature-tab{color:#80634f;border-color:rgba(108,51,17,.1);padding-left:22px}.neo-feature-tab svg{color:#896047}.neo-feature-tab span{color:#98745e}.neo-feature-tab:hover,.neo-feature-tab.is-active{padding-left:29px;color:#431d08;background:linear-gradient(90deg,rgba(255,117,24,.17),rgba(255,255,255,.2))}.neo-feature-tab.is-active{box-shadow:inset 3px 0 ${ACCENT}}
        .neo-feature-stage{padding:42px 48px;background:radial-gradient(circle at 84% 16%,rgba(255,117,24,.17),transparent 25rem),linear-gradient(145deg,rgba(255,255,255,.75),rgba(255,244,235,.75))}.neo-feature-stage:before{display:none}.neo-stage-icon{background:#fff0e3;box-shadow:0 15px 35px rgba(210,84,7,.13)}.neo-stage-copy h3{color:#3b1b09}
        .neo-solution{border-color:rgba(108,51,17,.12)}.neo-flow>div{border-color:rgba(108,51,17,.12)}.neo-flow b{color:#4b2915}.neo-flow span{color:#826b5c}
        .feature-sim{position:relative;height:245px;margin-top:28px;overflow:hidden;border:1px solid rgba(125,58,16,.12);border-radius:24px;background:linear-gradient(145deg,#fff,#fff2e8);box-shadow:inset 0 1px #fff}
        .kitchen-pos-sim{display:grid;grid-template-columns:1.25fr .75fr;gap:12px;padding:20px}.menu-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.menu-grid span{display:grid;grid-template-columns:30px 1fr;align-items:center;padding:9px;border:1px solid rgba(123,56,14,.1);border-radius:12px;background:#fff;animation:kitchen-rise .6s both;animation-delay:var(--delay)}.menu-grid i{grid-row:1/3;width:24px;height:24px;border-radius:8px;background:#ffe0c9;color:${ACCENT};font-style:normal;display:grid;place-items:center}.menu-grid b{font-size:9px}.menu-grid small{font-size:7px;color:${ACCENT_2}}.order-bill{padding:17px;border-radius:16px;color:#fff;background:#4b210b;display:flex;flex-direction:column}.order-bill small{font-size:8px;color:#d6b9a5}.order-bill>b{font:700 22px ${JK};margin:8px 0 auto}.order-bill>div{display:flex;justify-content:space-between;align-items:end;padding-top:12px;border-top:1px solid rgba(255,255,255,.13)}.order-bill>div span{font-size:9px}.order-bill strong{color:#ff9a4c}.order-bill button{border:0;border-radius:9px;background:${ACCENT};font-weight:800;padding:9px;margin-top:11px}.order-sweep{position:absolute;left:18px;right:41%;height:2px;background:${ACCENT};box-shadow:0 0 16px ${ACCENT};animation:kitchen-scan 3s ease-in-out infinite}
        .kds-sim{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:22px}.kds-sim-ticket{position:relative;padding:19px;border-radius:17px;background:#fff;border:1px solid rgba(123,56,14,.11);box-shadow:0 15px 28px rgba(117,53,14,.08);animation:ticket-shift 5s ease-in-out infinite}.kds-sim-ticket small,.kds-sim-ticket strong,.kds-sim-ticket b,.kds-sim-ticket span{display:block}.kds-sim-ticket small{font-size:8px;color:${ACCENT};font-weight:800}.kds-sim-ticket strong{font:800 24px ${JK};margin:18px 0 8px}.kds-sim-ticket b{font-size:11px}.kds-sim-ticket span{position:absolute;bottom:17px;font-size:9px;color:#856c5c}.kds-sim-ticket i{position:absolute;left:18px;right:18px;bottom:8px;height:3px;background:${ACCENT};border-radius:4px}.ticket-1{animation-delay:-1.7s}.ticket-2{animation-delay:-3.4s}.ticket-2 small,.ticket-2 i{color:${READY};background:${READY}}.ticket-runner{position:absolute;top:16px;width:9px;height:9px;border-radius:50%;background:${ACCENT};box-shadow:0 0 15px ${ACCENT};animation:ticket-run 4s linear infinite}
        .qr-sim{display:grid;grid-template-columns:.7fr 1.3fr;gap:36px;align-items:center;padding:24px 38px}.qr-phone{height:202px;border:1px solid rgba(123,56,14,.14);border-radius:28px;background:#fff;box-shadow:0 18px 36px rgba(117,53,14,.11);display:flex;flex-direction:column;align-items:center;justify-content:center;animation:phone-float 4s ease-in-out infinite}.qr-code{width:72px;height:72px;padding:8px;display:grid;grid-template-columns:repeat(3,1fr);gap:4px;border:2px solid #4b210b;border-radius:11px}.qr-code span{background:#4b210b}.qr-phone b{font-size:11px;margin-top:13px}.qr-phone small{font-size:8px;color:#8a7161}.qr-flow{position:relative;display:grid;gap:20px}.qr-flow>span{display:flex;align-items:center;gap:12px;font-size:11px;position:relative;z-index:2}.qr-flow i{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#fff0e4;color:${ACCENT_2};font-style:normal;font-weight:800}.qr-flow em{position:absolute;left:16px;top:10px;bottom:10px;width:2px;background:#f7c5a5}.qr-flow em:after{content:"";position:absolute;width:8px;height:8px;left:-3px;border-radius:50%;background:${ACCENT};box-shadow:0 0 12px ${ACCENT};animation:qr-path 3s linear infinite}
        .table-sim{padding:21px 26px}.floor-label{display:flex;align-items:center;gap:14px;margin-bottom:15px}.floor-label>b{margin-right:auto;font-size:11px}.floor-label span{font-size:8px;color:#7f6758}.floor-label i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#6ee2a0;margin-right:5px}.floor-label span:last-child i{background:${ACCENT}}.floor-plan{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.floor-plan button{height:76px;border:1px solid rgba(123,56,14,.12);border-radius:15px;background:#fff;color:#4c2a16;position:relative;animation:kitchen-rise .5s both;animation-delay:var(--delay)}.floor-plan button>i{position:absolute;inset:8px;border:1px dashed #cbdacb;border-radius:10px}.floor-plan b,.floor-plan small{display:block;position:relative}.floor-plan b{font:800 17px ${JK}}.floor-plan small{font-size:7px;color:#7a8b7f}.floor-plan button.occupied{background:#fff2e6;border-color:rgba(255,117,24,.35)}.floor-plan button.occupied i{border-color:${ACCENT}}.floor-plan button.occupied small{color:${ACCENT_2}}.floor-pulse{position:absolute;width:70px;height:70px;left:39%;top:51%;border-radius:50%;border:1px solid ${ACCENT};animation:floor-pulse 2.8s ease-out infinite}
        .recipe-sim{display:grid;place-items:center}.dish-core,.ingredient{position:absolute;display:grid;place-items:center;text-align:center;border-radius:18px;background:#fff;box-shadow:0 15px 35px rgba(117,53,14,.11);z-index:2}.dish-core{width:112px;height:112px;color:${ACCENT}}.dish-core b,.dish-core small,.ingredient b,.ingredient small{display:block}.dish-core b{font-size:10px;color:#482512}.dish-core small,.ingredient small{font-size:7px;color:#826c5e}.ingredient{width:100px;height:64px}.ingredient i{position:absolute;top:-4px;width:8px;height:8px;border-radius:50%;background:${ACCENT};box-shadow:0 0 11px ${ACCENT}}.ingredient b{font-size:9px}.ingredient-0{left:5%;top:18%}.ingredient-1{right:6%;top:14%}.ingredient-2{right:12%;bottom:9%}.ingredient-3{left:13%;bottom:8%}.recipe-orbit{position:absolute;width:63%;height:75%;border:1px solid rgba(255,117,24,.25);border-radius:50%;animation:recipe-spin 11s linear infinite}.recipe-packet{position:absolute;width:12px;height:12px;border-radius:50%;background:${ACCENT};box-shadow:0 0 16px ${ACCENT};animation:recipe-packet 5s ease-in-out infinite}
        .ops-report-sim{display:grid;grid-template-columns:.75fr .7fr 1fr;gap:25px;align-items:center;padding:25px}.ops-summary small,.ops-summary b,.ops-summary span{display:block}.ops-summary small{font-size:8px;color:${ACCENT_2};font-weight:800}.ops-summary b{font:700 20px/1.2 ${JK};margin:10px 0}.ops-summary span{font-size:8px;color:#816b5d}.ops-radar{width:145px;height:145px;border:1px solid #e5cdbd;border-radius:50%;position:relative;background:repeating-radial-gradient(circle,transparent 0 22px,rgba(151,75,27,.08) 23px 24px)}.ops-radar:before,.ops-radar:after{content:"";position:absolute;left:50%;top:0;bottom:0;border-left:1px solid #e5cdbd}.ops-radar:after{transform:rotate(90deg)}.ops-radar i{position:absolute;width:9px;height:9px;border-radius:50%;background:${ACCENT};box-shadow:0 0 12px ${ACCENT}}.ops-radar i:nth-child(1){left:22%;top:32%}.ops-radar i:nth-child(2){left:65%;top:19%}.ops-radar i:nth-child(3){left:74%;top:70%}.ops-radar i:nth-child(4){left:35%;top:75%}.ops-radar span{position:absolute;left:50%;top:50%;width:50%;height:2px;background:linear-gradient(90deg,${ACCENT},transparent);transform-origin:left;animation:radar 3s linear infinite}.ops-stream{display:grid;gap:9px}.ops-stream span{display:grid;grid-template-columns:10px 1fr auto;align-items:center;gap:7px;padding:9px;border-radius:10px;background:#fff;font-size:9px;animation:kitchen-rise .5s both;animation-delay:var(--delay)}.ops-stream i{width:7px;height:7px;border-radius:50%;background:${ACCENT}}.ops-stream b{color:${ACCENT_2}}
        .neo-cta-panel{color:white}.neo-footer{background:#fff0e5;border-color:rgba(108,51,17,.12)}.neo-footer-inner{color:#755b49}.neo-footer a:hover{color:#4b2915}
        .kds-screen{animation:dapur-kds-flight 9s cubic-bezier(.45,0,.55,1) infinite}.pos-terminal{animation:dapur-terminal-flight 9s cubic-bezier(.45,0,.55,1) infinite}.order-phone{animation:dapur-phone-route 9s cubic-bezier(.45,0,.55,1) infinite}.receipt-printer{animation:dapur-printer-route 9s cubic-bezier(.45,0,.55,1) infinite}.service-bell{animation:dapur-bell-route 9s cubic-bezier(.45,0,.55,1) infinite}.station-panel{animation:dapur-panel-left 9s cubic-bezier(.45,0,.55,1) infinite}.table-panel{animation:dapur-panel-right 9s cubic-bezier(.45,0,.55,1) infinite}.kds-ticket{animation:dapur-ticket-cycle 6s ease-in-out infinite}.kds-ticket:nth-child(2){animation-delay:-2s}.kds-ticket:nth-child(3){animation-delay:-4s}.terminal-menu>div{animation:dapur-menu-cycle 6s ease-in-out infinite}.terminal-menu>div:nth-child(2){animation-delay:-1.5s}.terminal-menu>div:nth-child(3){animation-delay:-3s}.terminal-menu>div:nth-child(4){animation-delay:-4.5s}.receipt-printer i{animation:dapur-receipt 3s ease-in-out infinite}.service-bell svg{animation:dapur-bell-ring 2.6s ease-in-out infinite}.order-step.active{animation:dapur-active-step 2.4s ease-in-out infinite}.kitchen-stage:after{content:"";position:absolute;left:12%;right:3%;bottom:7%;height:17%;border-radius:50%;background:radial-gradient(ellipse,rgba(207,85,9,.2),transparent 68%);filter:blur(17px);animation:dapur-shadow 9s ease-in-out infinite;z-index:-1}
        @keyframes dapur-kds-flight{0%,100%{transform:rotateY(-7deg) translate3d(0,0,0)}32%{transform:rotateY(-3deg) rotateX(2deg) translate3d(-12px,-16px,34px)}68%{transform:rotateY(-10deg) rotateX(-1deg) translate3d(6px,-5px,12px)}}@keyframes dapur-terminal-flight{0%,100%{transform:rotateY(7deg) rotateX(2deg) translate3d(0,0,10px)}35%{transform:rotateY(3deg) rotateX(-1deg) translate3d(13px,-13px,38px)}72%{transform:rotateY(10deg) rotateX(4deg) translate3d(-5px,-4px,18px)}}@keyframes dapur-phone-route{0%,100%{transform:translate3d(0,0,22px) rotate(7deg)}30%{transform:translate3d(-30px,-26px,55px) rotate(-3deg)}58%{transform:translate3d(-12px,-9px,32px) rotate(10deg)}82%{transform:translate3d(7px,-18px,26px) rotate(5deg)}}@keyframes dapur-printer-route{0%,100%{transform:translate3d(0,0,16px)}40%{transform:translate3d(-12px,-14px,38px) rotate(-2deg)}72%{transform:translate3d(8px,-5px,22px) rotate(2deg)}}@keyframes dapur-bell-route{0%,100%{transform:translate3d(0,0,18px)}34%{transform:translate3d(18px,-20px,42px) rotate(3deg)}70%{transform:translate3d(-4px,-7px,25px) rotate(-2deg)}}@keyframes dapur-panel-left{0%,100%{transform:translate3d(0,0,26px)}38%{transform:translate3d(19px,-12px,50px)}70%{transform:translate3d(5px,8px,32px)}}@keyframes dapur-panel-right{0%,100%{transform:translate3d(0,0,24px)}30%{transform:translate3d(-20px,11px,50px)}68%{transform:translate3d(-6px,-14px,34px)}}@keyframes dapur-ticket-cycle{0%,55%,100%{background:#130902}68%{background:#261005;box-shadow:inset 0 0 28px rgba(255,117,24,.08)}}@keyframes dapur-menu-cycle{0%,58%,100%{transform:none;border-color:${LINE}}70%{transform:translateY(-5px) scale(1.035);border-color:rgba(255,117,24,.46)}}@keyframes dapur-receipt{0%,100%{transform:translateY(-6px);height:17px}50%{transform:translateY(7px);height:34px}}@keyframes dapur-bell-ring{0%,70%,100%{transform:rotate(0)}76%{transform:rotate(11deg)}82%{transform:rotate(-9deg)}88%{transform:rotate(6deg)}}@keyframes dapur-active-step{50%{transform:translateX(4px);filter:drop-shadow(0 0 7px ${ACCENT})}}@keyframes dapur-shadow{50%{transform:scale(.77);opacity:.56}}
        @keyframes kitchen-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}@keyframes kitchen-scan{0%,100%{top:14%}50%{top:85%}}@keyframes ticket-shift{0%,100%{transform:none}50%{transform:translateY(-8px)}}@keyframes ticket-run{from{left:3%}to{left:96%}}@keyframes phone-float{50%{transform:translateY(-10px) rotate(2deg)}}@keyframes qr-path{from{top:0}to{top:100%}}@keyframes floor-pulse{from{transform:scale(.3);opacity:.8}to{transform:scale(3);opacity:0}}@keyframes recipe-spin{to{transform:rotate(360deg)}}@keyframes recipe-packet{0%,100%{transform:translate(-185px,-70px)}25%{transform:translate(175px,-70px)}50%{transform:translate(175px,70px)}75%{transform:translate(-185px,70px)}}@keyframes radar{to{transform:rotate(360deg)}}
        @media(max-width:720px){.neo-workbench{border-radius:22px}.neo-feature-stage{padding:28px 20px}.feature-sim{height:275px}.kds-sim{padding:14px;gap:7px}.kds-sim-ticket{padding:11px}.qr-sim{padding:20px;grid-template-columns:.9fr 1.1fr;gap:15px}.floor-plan{grid-template-columns:repeat(4,1fr);gap:5px}.floor-plan button{height:72px}.ops-report-sim{grid-template-columns:1fr 1fr}.ops-summary{display:none}}
      `}</style>
      <Nav user={user} />
      <main>
        <section className="neo-hero">
          <div className="neo-copy">
            <span className="neo-kicker">Sistem Restoran &amp; F&amp;B</span>
            <h1 className="neo-title" data-testid="hero-title">Restoran Lebih <span>Efisien, Layanan Lebih Cepat, Pelanggan Lebih Puas.</span></h1>
            <p className="neo-lead">DapurOS membantu mengelola pesanan, kasir, meja, kitchen display, menu, resep, inventori bahan, dan laporan dalam satu sistem operasional F&amp;B.</p>
            <div className="neo-cta">
              <Link to="/dapuros/register" className="neo-button neo-primary" data-testid="hero-cta-primary">Mulai Gratis <ArrowRight size={16} style={{ display: "inline", marginLeft: 7 }} /></Link>
              <Link to="/dapuros/pricing" className="neo-button" data-testid="hero-cta-secondary">Lihat Harga</Link>
            </div>
            <div className="neo-checks"><div className="neo-check"><b><CheckCircle2 size={15} />Operasional F&amp;B</b>Fokus pada alur front-of-house dan back-of-house.</div><div className="neo-check"><b><CheckCircle2 size={15} />Pesanan Terhubung</b>Kasir, meja, dan dapur berada dalam alur yang sama.</div><div className="neo-check"><b><CheckCircle2 size={15} />Bagian dari DagangOS</b>Identitas DapurOS tetap terhubung dengan parent ecosystem.</div></div>
          </div>
          <TiltWrap><KitchenVisual /></TiltWrap>
        </section>

        <section className="neo-strip"><div className="neo-strip-inner">{QUICK_FEATURES.map((item) => <div className="neo-strip-item" key={item.label}><item.icon size={17} /><span>{item.label}</span></div>)}</div></section>

        <section id="fitur" className="neo-section">
          <div className="neo-section-head"><div><small>Fitur utama</small><h2>Perangkat operasional untuk restoran</h2></div><p>Pilih modul untuk melihat bagaimana DapurOS menyatukan pelayanan, produksi, dan data operasional.</p></div>
          <div className="neo-workbench">
            <div className="neo-feature-rail" role="tablist" aria-label="Fitur DapurOS">
              {FEATURES.map((feature, index) => (
                <button key={feature.title} type="button" role="tab" aria-selected={activeFeature === index} className={`neo-feature-tab ${activeFeature === index ? "is-active" : ""}`} onClick={() => setActiveFeature(index)} onMouseEnter={() => setActiveFeature(index)}>
                  <feature.icon size={20} /><b>{feature.title}</b><span>0{index + 1}</span>
                </button>
              ))}
            </div>
            <div className="neo-feature-stage" key={selectedFeature.title}>
              <div className="neo-stage-head"><div className="neo-stage-icon"><SelectedFeatureIcon size={32} /></div><div className="neo-stage-copy"><small>Modul aktif · 0{activeFeature + 1}</small><h3>{selectedFeature.title}</h3><p>{selectedFeature.text}</p></div></div>
              <RestaurantFeatureScene index={activeFeature} />
            </div>
          </div>
        </section>

        <section id="solusi" className="neo-section" style={{ paddingTop: 0 }}><div className="neo-solution"><div className="neo-solution-copy"><h2>Dari pesanan masuk sampai laporan.</h2><p>DapurOS menghubungkan proses pelayanan dan dapur agar pesanan, status, bahan, dan transaksi dapat dikelola dalam sistem yang sama.</p></div><div className="neo-flow"><div><QrCode size={24} /><b>Pesanan</b><span>Order masuk dari kasir atau alur QR.</span></div><div><ClipboardList size={24} /><b>Routing</b><span>Pesanan diteruskan ke layar operasional.</span></div><div><CookingPot size={24} /><b>Dapur</b><span>Tim memperbarui proses penyajian.</span></div><div><ReceiptText size={24} /><b>Selesai</b><span>Transaksi dan laporan tercatat.</span></div></div></div></section>

        <section className="neo-cta-panel"><div><h2>Mulai kelola operasional restoran Anda.</h2><p>Buat akun DapurOS atau tinjau paket yang tersedia.</p></div><div className="neo-cta"><Link to="/dapuros/register" className="neo-button neo-primary">Mulai Gratis</Link><Link to="/dapuros/pricing" className="neo-button">Lihat Harga</Link></div></section>
      </main>
      <footer id="footer" className="neo-footer"><div className="neo-footer-inner"><div className="neo-footer-brand"><img src="/assets/brand/dapuros-icon.png" alt="" /><span>© 2026 DapurOS · PT DagangOS Digital Indonesia</span></div><div className="neo-footer-links"><Link to="/dapuros/pricing">Harga</Link><Link to="/dapuros/login">Masuk</Link><a href="/">DagangOS</a></div></div></footer>
    </div>
  );
}
