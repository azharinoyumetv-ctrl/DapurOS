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
  { icon: LayoutGrid, title: "Manajemen Meja", text: "Atur meja, area, status penggunaan, dan tagihan sesuai operasional restoran." },
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
          <a href="/sumber-daya">Kontak</a>
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
        <a href="/sumber-daya" onClick={() => setOpen(false)}>Kontak</a>
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
        .neo-cta-panel{color:white}.neo-footer{background:#fff0e5;border-color:rgba(108,51,17,.12)}.neo-footer-inner{color:#755b49}.neo-footer a:hover{color:#4b2915}
        .kds-screen{animation:dapur-kds-flight 9s cubic-bezier(.45,0,.55,1) infinite}.pos-terminal{animation:dapur-terminal-flight 9s cubic-bezier(.45,0,.55,1) infinite}.order-phone{animation:dapur-phone-route 9s cubic-bezier(.45,0,.55,1) infinite}.receipt-printer{animation:dapur-printer-route 9s cubic-bezier(.45,0,.55,1) infinite}.service-bell{animation:dapur-bell-route 9s cubic-bezier(.45,0,.55,1) infinite}.station-panel{animation:dapur-panel-left 9s cubic-bezier(.45,0,.55,1) infinite}.table-panel{animation:dapur-panel-right 9s cubic-bezier(.45,0,.55,1) infinite}.kds-ticket{animation:dapur-ticket-cycle 6s ease-in-out infinite}.kds-ticket:nth-child(2){animation-delay:-2s}.kds-ticket:nth-child(3){animation-delay:-4s}.terminal-menu>div{animation:dapur-menu-cycle 6s ease-in-out infinite}.terminal-menu>div:nth-child(2){animation-delay:-1.5s}.terminal-menu>div:nth-child(3){animation-delay:-3s}.terminal-menu>div:nth-child(4){animation-delay:-4.5s}.receipt-printer i{animation:dapur-receipt 3s ease-in-out infinite}.service-bell svg{animation:dapur-bell-ring 2.6s ease-in-out infinite}.order-step.active{animation:dapur-active-step 2.4s ease-in-out infinite}.kitchen-stage:after{content:"";position:absolute;left:12%;right:3%;bottom:7%;height:17%;border-radius:50%;background:radial-gradient(ellipse,rgba(207,85,9,.2),transparent 68%);filter:blur(17px);animation:dapur-shadow 9s ease-in-out infinite;z-index:-1}
        @keyframes dapur-kds-flight{0%,100%{transform:rotateY(-7deg) translate3d(0,0,0)}32%{transform:rotateY(-3deg) rotateX(2deg) translate3d(-12px,-16px,34px)}68%{transform:rotateY(-10deg) rotateX(-1deg) translate3d(6px,-5px,12px)}}@keyframes dapur-terminal-flight{0%,100%{transform:rotateY(7deg) rotateX(2deg) translate3d(0,0,10px)}35%{transform:rotateY(3deg) rotateX(-1deg) translate3d(13px,-13px,38px)}72%{transform:rotateY(10deg) rotateX(4deg) translate3d(-5px,-4px,18px)}}@keyframes dapur-phone-route{0%,100%{transform:translate3d(0,0,22px) rotate(7deg)}30%{transform:translate3d(-30px,-26px,55px) rotate(-3deg)}58%{transform:translate3d(-12px,-9px,32px) rotate(10deg)}82%{transform:translate3d(7px,-18px,26px) rotate(5deg)}}@keyframes dapur-printer-route{0%,100%{transform:translate3d(0,0,16px)}40%{transform:translate3d(-12px,-14px,38px) rotate(-2deg)}72%{transform:translate3d(8px,-5px,22px) rotate(2deg)}}@keyframes dapur-bell-route{0%,100%{transform:translate3d(0,0,18px)}34%{transform:translate3d(18px,-20px,42px) rotate(3deg)}70%{transform:translate3d(-4px,-7px,25px) rotate(-2deg)}}@keyframes dapur-panel-left{0%,100%{transform:translate3d(0,0,26px)}38%{transform:translate3d(19px,-12px,50px)}70%{transform:translate3d(5px,8px,32px)}}@keyframes dapur-panel-right{0%,100%{transform:translate3d(0,0,24px)}30%{transform:translate3d(-20px,11px,50px)}68%{transform:translate3d(-6px,-14px,34px)}}@keyframes dapur-ticket-cycle{0%,55%,100%{background:#130902}68%{background:#261005;box-shadow:inset 0 0 28px rgba(255,117,24,.08)}}@keyframes dapur-menu-cycle{0%,58%,100%{transform:none;border-color:${LINE}}70%{transform:translateY(-5px) scale(1.035);border-color:rgba(255,117,24,.46)}}@keyframes dapur-receipt{0%,100%{transform:translateY(-6px);height:17px}50%{transform:translateY(7px);height:34px}}@keyframes dapur-bell-ring{0%,70%,100%{transform:rotate(0)}76%{transform:rotate(11deg)}82%{transform:rotate(-9deg)}88%{transform:rotate(6deg)}}@keyframes dapur-active-step{50%{transform:translateX(4px);filter:drop-shadow(0 0 7px ${ACCENT})}}@keyframes dapur-shadow{50%{transform:scale(.77);opacity:.56}}
        @keyframes kitchen-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}@keyframes kitchen-scan{0%,100%{top:14%}50%{top:85%}}@keyframes ticket-shift{0%,100%{transform:none}50%{transform:translateY(-8px)}}@keyframes ticket-run{from{left:3%}to{left:96%}}@keyframes phone-float{50%{transform:translateY(-10px) rotate(2deg)}}@keyframes qr-path{from{top:0}to{top:100%}}@keyframes floor-pulse{from{transform:scale(.3);opacity:.8}to{transform:scale(3);opacity:0}}@keyframes recipe-spin{to{transform:rotate(360deg)}}@keyframes recipe-packet{0%,100%{transform:translate(-185px,-70px)}25%{transform:translate(175px,-70px)}50%{transform:translate(175px,70px)}75%{transform:translate(-185px,70px)}}@keyframes radar{to{transform:rotate(360deg)}}
      `}</style>
      <style>{`
        .neo-page{background:#070706;color:#fffaf5}.neo-page:before{background:radial-gradient(circle at 78% 8%,rgba(255,117,24,.16),transparent 34rem),radial-gradient(circle at 12% 46%,rgba(29,105,202,.09),transparent 30rem),linear-gradient(rgba(255,151,75,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,151,75,.025) 1px,transparent 1px);background-size:auto,auto,46px 46px,46px 46px}
        .neo-nav{background:rgba(7,7,6,.84);border-color:rgba(255,155,84,.16);box-shadow:0 14px 46px rgba(0,0,0,.28)}.neo-links,.neo-mobile a{color:#baa99b}.neo-links a:hover{color:#fff}.neo-button{color:#fff5ed;background:rgba(24,15,9,.72);border-color:rgba(255,155,84,.2)}.neo-primary{color:#321300}.neo-menu{color:#fff;background:#170d07}
        .neo-kicker{background:rgba(52,22,6,.72);color:#ffd7bd;border-color:rgba(255,117,24,.32)}.neo-lead,.neo-section-head p,.neo-stage-copy p,.neo-solution-copy p{color:#b5a398}.neo-check{color:#9e8b7e}.neo-check b{color:#fff8f2}
        .neo-hero-cinematic{grid-template-columns:.82fr 1.18fr;gap:30px}
        .neo-hero-cinematic .neo-title{font-size:clamp(46px,4.35vw,58px);line-height:1.01}
        .hero-scene-image{height:570px;position:relative;overflow:hidden;border:1px solid rgba(255,133,47,.22);border-radius:30px;background:#070503;isolation:isolate;box-shadow:0 40px 90px rgba(0,0,0,.46),inset 0 1px rgba(255,255,255,.04)}
        .hero-scene-image:before{content:"";position:absolute;inset:-10px;background:url("/dapuros/assets/scenes/dapuros-kitchen.png") 77% center/cover no-repeat;animation:kitchen-camera 13s ease-in-out infinite alternate;z-index:-3}
        .hero-scene-image:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,7,6,.48),transparent 38%),linear-gradient(180deg,transparent 62%,rgba(7,5,3,.7));z-index:-2}
        .scene-sweep{position:absolute;left:-30%;top:0;width:24%;height:100%;transform:skewX(-12deg);background:linear-gradient(90deg,transparent,rgba(255,137,50,.13),transparent);animation:kitchen-sweep 6.5s ease-in-out infinite}
        .scene-sigil{position:absolute;right:28px;bottom:28px;width:94px;height:94px;display:grid;place-items:center;border:1px solid rgba(255,132,44,.38);border-radius:28px;background:rgba(24,10,3,.76);box-shadow:0 22px 50px rgba(0,0,0,.4),0 0 35px rgba(255,117,24,.17);backdrop-filter:blur(14px);animation:sigil-float 5s ease-in-out infinite}
        .scene-sigil:before,.scene-sigil:after{content:"";position:absolute;inset:-13px;border:1px solid rgba(255,117,24,.2);border-radius:36px;animation:sigil-pulse 3.6s ease-out infinite}.scene-sigil:after{animation-delay:-1.8s}
        .scene-sigil img{width:62px;height:62px;object-fit:contain;filter:drop-shadow(0 0 18px rgba(255,117,24,.48))}
        .scene-particle{position:absolute;width:8px;height:8px;border-radius:50%;background:${ACCENT};box-shadow:0 0 16px ${ACCENT};animation:kitchen-particle 8s ease-in-out infinite}.scene-particle.p1{left:14%;top:24%}.scene-particle.p2{left:48%;top:14%;animation-delay:-2.7s}.scene-particle.p3{left:38%;bottom:12%;animation-delay:-5.1s}
        .neo-strip{background:rgba(15,10,6,.78);border-color:rgba(255,147,70,.14)}.neo-strip-item{color:#ae9a8c;border-color:rgba(255,147,70,.13)}
        .neo-workbench{border-color:rgba(255,147,70,.14);background:#100b08;box-shadow:0 34px 90px rgba(0,0,0,.32)}.neo-feature-rail{background:#0b0806;border-color:rgba(255,147,70,.13)}.neo-feature-tab{color:#9f8d80;border-color:rgba(255,147,70,.1)}.neo-feature-tab:hover,.neo-feature-tab.is-active{color:#fff7f0;background:linear-gradient(90deg,rgba(255,117,24,.17),transparent)}
        .neo-feature-stage{background:radial-gradient(circle at 84% 16%,rgba(255,117,24,.13),transparent 25rem),linear-gradient(145deg,#140c07,#0c0907)}.neo-stage-icon{background:#241207}.neo-stage-copy h3{color:#fff8f2}
        .neo-solution{border-color:rgba(255,147,70,.14)}.neo-flow>div{border-color:rgba(255,147,70,.13)}.neo-flow b{color:#fff5ed}.neo-flow span{color:#a79385}.neo-footer{background:#0e0906;border-color:rgba(255,147,70,.14)}.neo-footer-inner{color:#aa9688}.neo-footer a:hover{color:#fff}
        @keyframes kitchen-camera{0%{transform:scale(1.03) translate3d(-3px,0,0)}100%{transform:scale(1.09) translate3d(11px,-8px,0)}}@keyframes kitchen-sweep{0%,18%{left:-30%;opacity:0}42%{opacity:1}70%,100%{left:115%;opacity:0}}@keyframes sigil-float{50%{transform:translateY(-11px) rotate(1.5deg)}}@keyframes sigil-pulse{0%{transform:scale(.84);opacity:.8}100%{transform:scale(1.3);opacity:0}}@keyframes kitchen-particle{0%,100%{transform:translate3d(0,0,0);opacity:.35}35%{transform:translate3d(35px,-22px,0);opacity:1}70%{transform:translate3d(70px,18px,0);opacity:.55}}
        @media(max-width:1050px){.neo-hero-cinematic{grid-template-columns:1fr}.hero-scene-image{width:min(900px,100%);height:520px;margin:auto}}
        @media(max-width:720px){.hero-scene-image{height:430px;margin-top:14px;border-radius:23px}.hero-scene-image:before{background-position:72% center}.scene-sigil{right:18px;bottom:18px;width:76px;height:76px}.scene-sigil img{width:50px;height:50px}}
        @media(prefers-reduced-motion:reduce){.hero-scene-image:before,.scene-sweep,.scene-sigil,.scene-sigil:before,.scene-sigil:after,.scene-particle{animation:none}}
      `}</style>
      <Nav user={user} />
      <main>
        <section className="neo-hero neo-hero-cinematic">
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
          <div className="hero-scene-image dapuros-scene" aria-label="Lingkungan operasional restoran DapurOS">
            <i className="scene-sweep" aria-hidden="true" />
            <i className="scene-particle p1" aria-hidden="true" /><i className="scene-particle p2" aria-hidden="true" /><i className="scene-particle p3" aria-hidden="true" />
            <div className="scene-sigil" aria-hidden="true"><img src="/assets/brand/dapuros-icon.png" alt="" /></div>
          </div>
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
              <div className="neo-stage-head"><div className="neo-stage-icon"><SelectedFeatureIcon size={32} /></div><div className="neo-stage-copy"><small>Fitur · 0{activeFeature + 1}</small><h3>{selectedFeature.title}</h3><p>{selectedFeature.text}</p></div></div>
              <img src={activeFeature===5?"/screenshots/dapuros/tablet-about.png":"/screenshots/dapuros/tablet-checkout.png"} alt="Tampilan aplikasi DapurOS" loading="lazy" style={{width:"100%",maxHeight:360,objectFit:"contain",marginTop:24,borderRadius:12}}/>
            </div>
          </div>
        </section>

        <section id="solusi" className="neo-section" style={{ paddingTop: 0 }}><div className="neo-solution"><div className="neo-solution-copy"><h2>Dari pesanan masuk sampai laporan.</h2><p>DapurOS menghubungkan proses pelayanan dan dapur agar pesanan, status, bahan, dan transaksi dapat dikelola dalam sistem yang sama.</p></div><div className="neo-flow"><div><QrCode size={24} /><b>Pesanan</b><span>Order masuk dari kasir atau alur QR.</span></div><div><ClipboardList size={24} /><b>Routing</b><span>Pesanan diteruskan ke layar operasional.</span></div><div><CookingPot size={24} /><b>Dapur</b><span>Tim memperbarui proses penyajian.</span></div><div><ReceiptText size={24} /><b>Selesai</b><span>Transaksi dan laporan tercatat.</span></div></div></div></section>

        <section className="neo-cta-panel"><div><h2>Mulai kelola operasional restoran Anda.</h2><p>Buat akun DapurOS atau tinjau paket yang tersedia.</p></div><div className="neo-cta"><Link to="/dapuros/register" className="neo-button neo-primary">Mulai Gratis</Link><Link to="/dapuros/pricing" className="neo-button">Lihat Harga</Link></div></section>
      </main>
      <footer id="footer" className="neo-footer"><div className="neo-footer-inner"><div className="neo-footer-brand"><img src="/assets/brand/dapuros-icon.png" alt="" /><span>© 2026 DapurOS · PT DagangOS Digital Indonesia</span></div><div className="neo-footer-links"><Link to="/dapuros/pricing">Harga</Link><a href="/sumber-daya">Kontak</a><a href="/">DagangOS</a></div></div></footer>
    </div>
  );
}
