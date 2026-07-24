import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { ArrowRight, LayoutGrid, ChefHat, QrCode, CreditCard, Package, LineChart, Check } from "lucide-react";

const JK = "'Plus Jakarta Sans', 'Figtree', sans-serif";
const ORANGE = "#e8630a";
const ORANGE_DARK = "#c0530b";
const INK = "#241a12";
const BODY = "#5a4a3d";
const MUTED = "#948577";
const LINE = "#eee6dd";
const READY = "#0d9488";

const FEATURES = [
  { icon: LayoutGrid, t: "Denah meja interaktif", d: "Denah lantai visual multi-area — kelola meja kosong, tamu duduk, dan minta tagihan." },
  { icon: ChefHat, t: "Layar Dapur (KDS)", d: "Tiket pesanan real-time dengan timer masak, filter stasiun, dan indikator SLA." },
  { icon: Package, t: "Resep BOM otomatis", d: "Stok bahan baku mentah terpotong otomatis dan atomik setiap pesanan selesai." },
  { icon: QrCode, t: "Menu QR self-order", d: "Tamu pesan sendiri via QR meja dengan kustomisasi gula, es, dan catatan." },
  { icon: CreditCard, t: "Split-bill & EDC", d: "Bagi tagihan merata atau per item, plus simulasi mesin EDC multi-bank." },
  { icon: LineChart, t: "Laporan & pajak PB1", d: "Riwayat transaksi, produk terlaris, dan perhitungan pajak restoran otomatis." },
];

function Nav({ user }) {
  return (
    <header className="sticky top-0 z-50 backdrop-blur border-b" style={{ background: "rgba(255,250,246,.85)", borderColor: LINE }} data-testid="landing-nav">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <Link to="/dapuros" className="flex items-center gap-2.5" data-testid="landing-logo">
          <img src="/assets/brand/dapuros-icon.png" alt="" className="w-8 h-8 object-contain" />
          <span className="font-bold text-lg" style={{ fontFamily: JK, color: INK }}>DapurOS</span>
          <span className="text-xs font-medium" style={{ color: MUTED }}>by DagangOS</span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium" style={{ color: BODY }}>
          <a href="#fitur" className="hover:opacity-70">Fitur</a>
          <Link to="/dapuros/pricing" className="hover:opacity-70">Harga</Link>
          <a href="/" className="hover:opacity-70" style={{ color: ORANGE }}>Ekosistem DagangOS</a>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Link to="/dapuros/app/dashboard" className="px-4 py-2 rounded-xl text-white font-semibold text-sm" style={{ background: ORANGE }} data-testid="nav-dashboard-btn">Buka Dashboard →</Link>
          ) : (
            <>
              <Link to="/dapuros/login" className="px-4 py-2 rounded-xl font-semibold text-sm hover:bg-orange-50" style={{ color: INK }} data-testid="nav-login-btn">Masuk</Link>
              <Link to="/dapuros/register" className="px-4 py-2 rounded-xl text-white font-semibold text-sm" style={{ background: ORANGE }} data-testid="nav-register-btn">Mulai Gratis</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function TiltWrap({ children }) {
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const onMove = (e) => {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    setTilt({ ry: (px - 0.5) * 10, rx: (0.5 - py) * 8 });
  };
  const onLeave = () => setTilt({ rx: 0, ry: 0 });
  return (
    <div
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ transform: `perspective(1000px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`, transition: "transform .4s cubic-bezier(.16,1,.3,1)", transformStyle: "preserve-3d" }}
    >
      {children}
    </div>
  );
}

function KdsMockup() {
  const tickets = [
    { m: "Meja 04", it: ["2x Nasi Goreng", "1x Es Teh"], t: "00:42", s: "Dimasak", c: "#b5852a", bg: "#f5ecd8" },
    { m: "Meja 12", it: ["1x Kopi Susu"], t: "01:58", s: "Siap Saji", c: READY, bg: "#e3f4f1" },
    { m: "Bar 02", it: ["3x Mojito"], t: "00:08", s: "Baru", c: "#6b766e", bg: "#f1f2ee" },
  ];
  return (
    <div className="rounded-2xl border bg-white overflow-hidden" style={{ borderColor: LINE, boxShadow: "0 40px 80px -40px rgba(232,99,10,.32)" }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: LINE, background: "#fdf6f0" }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#f0e0d5" }} /><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#f0e0d5" }} /><span className="w-2.5 h-2.5 rounded-full" style={{ background: "#f0e0d5" }} />
        <span className="ml-2 text-xs font-semibold" style={{ color: MUTED }}>DapurOS — Layar Dapur (KDS)</span>
      </div>
      <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {tickets.map((k) => (
          <div key={k.m} className="rounded-xl border p-3" style={{ borderColor: LINE }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold" style={{ color: INK }}>{k.m}</span>
              <span className="text-sm font-bold" style={{ fontFamily: JK, color: INK }}>{k.t}</span>
            </div>
            <ul className="text-xs space-y-0.5 mb-3" style={{ color: MUTED }}>{k.it.map((i) => <li key={i}>{i}</li>)}</ul>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded" style={{ background: k.bg, color: k.c }}>{k.s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DapurOS() {
  const { user } = useAuth();

  useEffect(() => {
    const token = localStorage.getItem("dagangos_token") || localStorage.getItem("geraina_token") || localStorage.getItem("dapuros_token");
    if (user || token) {
      window.location.replace("/dapuros/app/dashboard");
    }
  }, [user]);

  return (
    <div style={{ fontFamily: JK, background: "#fffaf6", color: BODY }}>
      <Nav user={user} />

      {/* Hero */}
      <section className="relative overflow-hidden max-w-7xl mx-auto px-5 sm:px-8 pt-16 sm:pt-20 pb-14 grid lg:grid-cols-2 gap-12 items-center">
        <svg className="absolute inset-0 w-full h-full pointer-events-none -z-10" aria-hidden="true">
          <defs>
            <pattern id="circuitDapurHero" width="140" height="140" patternUnits="userSpaceOnUse">
              <g fill="none" stroke={ORANGE} strokeOpacity=".08" strokeWidth="1.5">
                <path d="M18 18 L18 55 L70 55 L70 100" />
                <path d="M120 10 L120 45 L95 45 L95 130" />
                <path d="M40 130 L40 95 L10 95" />
              </g>
              <g fill={ORANGE} fillOpacity=".12">
                <circle cx="18" cy="18" r="3" /><circle cx="70" cy="100" r="3" />
                <circle cx="120" cy="10" r="2.4" /><circle cx="95" cy="130" r="2.4" />
                <circle cx="40" cy="130" r="2.4" /><circle cx="10" cy="95" r="2.4" />
              </g>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#circuitDapurHero)" />
        </svg>
        <div className="text-center lg:text-left">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs sm:text-sm font-medium mb-6" style={{ borderColor: LINE, color: BODY }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: ORANGE }} /> F&amp;B & Restoran OS · bagian dari DagangOS
          </span>
          <h1 className="text-4xl sm:text-6xl font-extrabold leading-[1.05]" style={{ fontFamily: JK, color: INK, letterSpacing: "-.02em" }} data-testid="hero-title">
            Operasi restoran &amp; kafe <span style={{ color: ORANGE }}>tanpa ribet.</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg max-w-xl mx-auto lg:mx-0 leading-relaxed" style={{ color: BODY }}>
            Denah meja, Layar Dapur (KDS) real-time, resep BOM, dan kasir — semua terhubung dalam satu sistem. 100% Bahasa Indonesia.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3">
            <Link to="/dapuros/register" className="px-6 py-3.5 rounded-xl text-white font-semibold text-sm sm:text-base" style={{ background: ORANGE }} data-testid="hero-cta-primary">Mulai gratis</Link>
            <Link to="/dapuros/pricing" className="px-6 py-3.5 rounded-xl border font-semibold text-sm sm:text-base" style={{ borderColor: LINE, color: INK }} data-testid="hero-cta-secondary">Lihat harga</Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm justify-center lg:justify-start" style={{ color: MUTED }}>
            <span className="flex items-center gap-1.5"><Check size={15} style={{ color: ORANGE }} /> Tanpa kartu kredit</span>
            <span className="flex items-center gap-1.5"><Check size={15} style={{ color: ORANGE }} /> Siap dalam 5 menit</span>
          </div>
        </div>
        <TiltWrap>
          <KdsMockup />
        </TiltWrap>
      </section>

      {/* Features */}
      <section id="fitur" className="border-y" style={{ borderColor: LINE, background: "#fdf6f0" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
          <div className="max-w-2xl mb-12">
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: ORANGE }}>Fitur</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold mt-2 leading-tight" style={{ fontFamily: JK, color: INK }}>Dapur dan kasir dalam satu sistem</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.t} className="group relative rounded-2xl p-6 bg-white overflow-hidden transition-all duration-300 hover:-translate-y-1" style={{ border: `1px solid ${LINE}`, boxShadow: "0 1px 2px rgba(36,26,18,.04)" }}>
                <div className="absolute top-0 left-0 right-0 h-[3px] scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300" style={{ background: ORANGE }} />
                <f.icon size={26} strokeWidth={1.75} style={{ color: ORANGE }} />
                <h3 className="font-bold text-lg mt-4" style={{ fontFamily: JK, color: INK }}>{f.t}</h3>
                <p className="text-sm mt-2 leading-relaxed" style={{ color: BODY }}>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
        <div className="rounded-3xl px-6 sm:px-16 py-16 text-center relative overflow-hidden" style={{ background: `linear-gradient(155deg, #a8480f, #7c3610)` }}>
          <div className="absolute -left-20 -bottom-20 w-72 h-72 rounded-full" style={{ background: "rgba(255,255,255,.07)" }} />
          <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full" style={{ background: "rgba(255,255,255,.07)" }} />
          <h2 className="relative text-3xl sm:text-4xl font-extrabold text-white max-w-xl mx-auto leading-tight" style={{ fontFamily: JK }}>Siap bikin dapur Anda tertib?</h2>
          <p className="relative mt-4 max-w-md mx-auto text-sm sm:text-base" style={{ color: "#f0d8c6" }}>Mulai gratis hari ini. Tanpa kartu kredit, langsung pakai.</p>
          <div className="relative mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            <Link to="/dapuros/register" className="px-7 py-3.5 rounded-xl bg-white font-semibold text-sm sm:text-base" style={{ color: ORANGE_DARK }}>Mulai gratis sekarang</Link>
            <Link to="/dapuros/login" className="px-7 py-3.5 rounded-xl border font-semibold text-sm sm:text-base text-white" style={{ borderColor: "rgba(255,255,255,.3)" }}>Masuk ke akun</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t" style={{ borderColor: LINE, background: "#fdf6f0" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm" style={{ color: MUTED }}>
          <div className="flex items-center gap-2.5">
            <img src="/assets/brand/dapuros-icon.png" alt="" className="w-6 h-6 object-contain" />
            <span>© 2026 DapurOS · DagangOS Digital Indonesia</span>
          </div>
          <div className="flex gap-6">
            <Link to="/dapuros/pricing" className="hover:opacity-70">Harga</Link>
            <a href="/" className="hover:opacity-70">DagangOS</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
