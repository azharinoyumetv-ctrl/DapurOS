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

export default function DapurOS() {
  const { user } = useAuth();
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

        <section id="fitur" className="neo-section"><div className="neo-section-head"><div><small>Fitur utama</small><h2>Perangkat operasional untuk restoran</h2></div><p>Struktur halaman dan interaksi mengikuti keluarga DagangOS, sedangkan visual oranye, objek dapur, dan konten mempertahankan karakter DapurOS.</p></div><div className="neo-grid">{FEATURES.map((feature) => <article className="neo-card" key={feature.title}><feature.icon size={28} strokeWidth={1.7} /><h3>{feature.title}</h3><p>{feature.text}</p></article>)}</div></section>

        <section id="solusi" className="neo-section" style={{ paddingTop: 0 }}><div className="neo-solution"><div className="neo-solution-copy"><h2>Dari pesanan masuk sampai laporan.</h2><p>DapurOS menghubungkan proses pelayanan dan dapur agar pesanan, status, bahan, dan transaksi dapat dikelola dalam sistem yang sama.</p></div><div className="neo-flow"><div><QrCode size={24} /><b>Pesanan</b><span>Order masuk dari kasir atau alur QR.</span></div><div><ClipboardList size={24} /><b>Routing</b><span>Pesanan diteruskan ke layar operasional.</span></div><div><CookingPot size={24} /><b>Dapur</b><span>Tim memperbarui proses penyajian.</span></div><div><ReceiptText size={24} /><b>Selesai</b><span>Transaksi dan laporan tercatat.</span></div></div></div></section>

        <section className="neo-cta-panel"><div><h2>Mulai kelola operasional restoran Anda.</h2><p>Buat akun DapurOS atau tinjau paket yang tersedia.</p></div><div className="neo-cta"><Link to="/dapuros/register" className="neo-button neo-primary">Mulai Gratis</Link><Link to="/dapuros/pricing" className="neo-button">Lihat Harga</Link></div></section>
      </main>
      <footer id="footer" className="neo-footer"><div className="neo-footer-inner"><div className="neo-footer-brand"><img src="/assets/brand/dapuros-icon.png" alt="" /><span>© 2026 DapurOS · PT DagangOS Digital Indonesia</span></div><div className="neo-footer-links"><Link to="/dapuros/pricing">Harga</Link><Link to="/dapuros/login">Masuk</Link><a href="/">DagangOS</a></div></div></footer>
    </div>
  );
}
