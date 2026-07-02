import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Leaf, ArrowRight, Utensils } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const { user, login } = useAuth();

  if (user) {
    return <Navigate to="/dapuros/app/dashboard" replace />;
  }

  const isDapurOS = true;
  const BrandIcon = isDapurOS ? Utensils : Leaf;
  const brandName = isDapurOS ? "DapurOS" : "Geraina POS";
  const tagline = isDapurOS
    ? "Sistem Kasir Meja & KDS khusus Kafe & Restoran"
    : "Kasir & Stok Pintar untuk Toko Indonesia";
  const desc = isDapurOS
    ? "Kelola pesanan meja, menu digital self-order, status memasak KDS, dan resep bahan baku dalam satu sistem."
    : "Kelola penjualan, stok, supplier, dan laporan toko dari satu aplikasi.";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      nav("/dapuros/app/dashboard");
    } catch (err) {
      setError(err?.response?.data?.detail || "Gagal masuk");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex ${isDapurOS ? "theme-dapuros" : ""}`}>
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative bg-grain"
           style={{ background: isDapurOS ? "linear-gradient(135deg, hsl(35,84%,18%), hsl(35,84%,12%))" : "linear-gradient(135deg, hsl(151,39%,17%), hsl(151,39%,12%))" }}
           data-testid="login-side">
        <Link to="/" className="text-white font-display font-bold text-xl flex items-center gap-2">
          <BrandIcon size={22} className="text-[hsl(9,65%,62%)]" /> {brandName} <span className="text-xs text-white/60 font-medium">by DagangOS</span>
        </Link>
        <div className="text-white space-y-4 max-w-md">
          <p className="label-tiny" style={{ color: "hsl(9,65%,75%)" }}>{brandName} by DagangOS</p>
          <h2 className="font-display text-4xl font-bold leading-tight">
            {isDapurOS ? "Operasi Restoran & Kafe Tanpa Ribet" : "Kasir & Stok Pintar untuk Toko Indonesia"}
          </h2>
          <p className="text-white/70">{desc}</p>
        </div>
        <p className="text-white/50 text-xs">© {brandName} by DagangOS</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-6" data-testid="login-form">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-display text-xl font-bold">{brandName}</span>
            </div>
            <p className="text-sm text-[hsl(var(--muted))]">{tagline}</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label-tiny block mb-2" data-testid="login-email-label">Alamat Email</label>
              <input
                type="email"
                required
                className="input-field"
                data-testid="login-email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@toko.com"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="label-tiny" data-testid="login-password-label">Kata Sandi</label>
              </div>
              <input
                type="password"
                required
                className="input-field"
                data-testid="login-password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && <p className="text-sm text-[hsl(var(--destructive))]" data-testid="login-error">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full" data-testid="login-submit-btn">
            {loading ? "Memproses…" : "Masuk"} <ArrowRight size={16} />
          </button>

          <p className="text-sm text-center text-[hsl(var(--muted))]">
            Belum punya toko?{" "}
            <Link to="/register" className="text-[hsl(var(--primary))] font-semibold" data-testid="login-to-register-link">
              Daftar gratis
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
