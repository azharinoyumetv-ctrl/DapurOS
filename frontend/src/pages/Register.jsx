import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Leaf, ArrowRight, Check, Utensils } from "lucide-react";

export default function Register() {
  const [storeName, setStoreName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const { register } = useAuth();

  const isDapurOS = true;
  const BrandIcon = isDapurOS ? Utensils : Leaf;
  const brandName = isDapurOS ? "DapurOS" : "Geraina POS";
  const tagline = isDapurOS
    ? "Sistem Kasir Meja & KDS khusus Kafe & Restoran"
    : "Daftar gratis, mulai jualan hari ini.";
  const titleText = isDapurOS ? "Buka restoran digital" : "Buka toko digital";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, password, storeName);
      nav("/app/dashboard");
    } catch (err) {
      setError(err?.response?.data?.detail || "Gagal mendaftar");
    } finally {
      setLoading(false);
    }
  };

  const perks = [
    "14 hari trial penuh, semua fitur",
    "Tanpa kartu kredit",
    "QRIS + e-wallet built-in",
    "Cabut kapan saja",
  ];

  return (
    <div className={`min-h-screen flex ${isDapurOS ? "theme-dapuros" : ""}`}>
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative bg-grain"
           style={{ background: isDapurOS ? "linear-gradient(135deg, hsl(35,84%,18%), hsl(35,84%,12%))" : "linear-gradient(135deg, hsl(151,39%,17%), hsl(151,39%,12%))" }}>
        <Link to="/" className="text-white font-display font-bold text-xl flex items-center gap-2">
          <BrandIcon size={22} className="text-[hsl(9,65%,62%)]" /> {brandName} <span className="text-xs text-white/60 font-medium">by DagangOS</span>
        </Link>
        <div className="text-white space-y-5 max-w-md">
          <p className="label-tiny" style={{ color: "hsl(9,65%,75%)" }}>{brandName} by DagangOS</p>
          <h2 className="font-display text-4xl font-bold leading-tight">
            {titleText}<br /> dalam 60 detik.
          </h2>
          <ul className="space-y-2 text-white/80 mt-4">
            {perks.map((p) => (
              <li key={p} className="flex items-center gap-2 text-sm">
                <Check size={16} className="text-[hsl(9,65%,62%)]" /> {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-white/50 text-xs">© {brandName} by DagangOS</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-6" data-testid="register-form">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-display text-xl font-bold">{brandName}</span>
            </div>
            <p className="text-sm text-[hsl(var(--muted))]">{tagline}</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label-tiny block mb-2" data-testid="register-store-label">Nama Restoran / Cafe</label>
              <input
                type="text"
                required
                className="input-field"
                data-testid="register-store-input"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Cafe Senja Bandung"
              />
            </div>
            <div>
              <label className="label-tiny block mb-2" data-testid="register-email-label">Alamat Email</label>
              <input
                type="email"
                required
                className="input-field"
                data-testid="register-email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@resto.com"
              />
            </div>
            <div>
              <label className="label-tiny block mb-2" data-testid="register-password-label">Kata Sandi</label>
              <input
                type="password"
                required
                className="input-field"
                minLength={6}
                data-testid="register-password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && <p className="text-sm text-[hsl(var(--destructive))]" data-testid="register-error">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full" data-testid="register-submit-btn">
            {loading ? "Memproses…" : "Mulai Trial 14 Hari"} <ArrowRight size={16} />
          </button>

          <p className="text-sm text-center text-[hsl(var(--muted))]">
            Sudah punya akun?{" "}
            <Link to="/login" className="text-[hsl(var(--primary))] font-semibold" data-testid="register-to-login-link">
              Masuk
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
