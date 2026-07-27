import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { ArrowRight } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const { user, login } = useAuth();

  if (user) return <Navigate to="/dapuros/app/dashboard" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      nav("/dapuros/app/dashboard");
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || "Email atau kata sandi tidak valid.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="product-public public-dapuros auth-page">
      <header className="auth-header">
        <Link to="/dapuros" className="auth-brand">
          <img src="/assets/brand/dapuros-icon.png" alt="" />
          <b>DapurOS</b>
          <small>by DagangOS</small>
        </Link>
        <nav aria-label="Navigasi akun DapurOS">
          <Link to="/dapuros/pricing">Lihat harga</Link>
          <Link to="/dapuros/register">Mulai gratis</Link>
        </nav>
      </header>

      <main className="auth-main">
        <section className="auth-story" aria-labelledby="dapuros-login-story">
          <span className="auth-kicker">DapurOS · Restaurant operations</span>
          <h2 id="dapuros-login-story">Kembali ke ritme layanan Anda.</h2>
          <p>Pesanan, meja, layar dapur, resep, bahan, pembayaran, dan laporan bergerak dalam satu alur operasional.</p>
          <div className="auth-scene" aria-hidden="true">
            <div className="auth-device auth-device--kitchen">
              <div className="auth-device__bar"><b>DapurOS · KDS</b><span>3 pesanan</span></div>
              <div className="auth-device__tickets"><i><small>MEJA 04</small><b>00:08</b></i><i><small>TAKEAWAY</small><b>00:12</b></i><i><small>MEJA 11</small><b>00:17</b></i></div>
            </div>
            <span className="auth-node">POS</span>
            <span className="auth-node">KDS</span>
            <span className="auth-node">BOM</span>
          </div>
        </section>

        <section className="auth-form-wrap">
          <form onSubmit={submit} className="auth-form" data-testid="login-form">
            <h1>Masuk ke DapurOS</h1>
            <p>Gunakan akun DagangOS yang terhubung dengan restoran Anda.</p>

            <div className="auth-field">
              <label htmlFor="dapuros-login-email" data-testid="login-email-label">Alamat email</label>
              <input id="dapuros-login-email" type="email" name="email" autoComplete="email" required data-testid="login-email-input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@restoran.com" />
            </div>

            <div className="auth-field">
              <label htmlFor="dapuros-login-password" data-testid="login-password-label">Kata sandi</label>
              <input id="dapuros-login-password" type="password" name="password" autoComplete="current-password" required data-testid="login-password-input" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" />
            </div>

            {error && <p className="auth-error" role="alert" data-testid="login-error">{error}</p>}

            <button type="submit" disabled={loading} data-testid="login-submit-btn" className="auth-submit">
              {loading ? "Memproses…" : "Masuk"} {!loading && <ArrowRight size={17} />}
            </button>

            <p className="auth-switch">Belum punya restoran? <Link to="/dapuros/register" data-testid="login-to-register-link">Daftar gratis</Link></p>
          </form>
        </section>
      </main>

      <footer className="public-contact-footer">
        <span>© 2026 DapurOS · PT DagangOS Digital Indonesia</span>
        <nav aria-label="Tautan perusahaan"><a href="/sumber-daya">Kontak</a><a href="/">DagangOS</a></nav>
      </footer>
    </div>
  );
}
