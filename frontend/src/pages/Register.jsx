import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { ArrowRight } from "lucide-react";

export default function Register() {
  const [storeName, setStoreName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const { register } = useAuth();

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, password, storeName);
      nav("/dapuros/app/dashboard");
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || "Gagal mendaftar.");
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
        <nav aria-label="Navigasi pendaftaran DapurOS">
          <Link to="/dapuros/pricing">Lihat harga</Link>
          <Link to="/dapuros/login">Masuk</Link>
        </nav>
      </header>

      <main className="auth-main auth-main--register">
        <section className="auth-story" aria-labelledby="dapuros-register-story">
          <span className="auth-kicker">DapurOS · Restaurant operations</span>
          <h2 id="dapuros-register-story">Mulai ritme layanan yang terhubung.</h2>
          <p>Buat ruang kerja restoran untuk pesanan, meja, layar dapur, resep, bahan, pembayaran, dan laporan operasional.</p>
          <div className="auth-scene" aria-hidden="true">
            <div className="auth-device auth-device--kitchen">
              <div className="auth-device__bar"><b>DapurOS · KDS</b><span>Siap dimulai</span></div>
              <div className="auth-device__tickets"><i><small>MEJA</small><b>POS</b></i><i><small>DAPUR</small><b>KDS</b></i><i><small>BAHAN</small><b>BOM</b></i></div>
            </div>
            <span className="auth-node">POS</span>
            <span className="auth-node">KDS</span>
            <span className="auth-node">BOM</span>
          </div>
        </section>

        <section className="auth-form-wrap">
          <form onSubmit={submit} className="auth-form" data-testid="register-form">
            <h1>Buat akun DapurOS</h1>
            <p>Mulai trial 14 hari tanpa kartu kredit.</p>

            <div className="auth-field">
              <label htmlFor="dapuros-register-store" data-testid="register-store-label">Nama restoran atau kafe</label>
              <input id="dapuros-register-store" name="organization" autoComplete="organization" required data-testid="register-store-input" value={storeName} onChange={(event) => setStoreName(event.target.value)} placeholder="Kafe Senja Bandung" />
            </div>

            <div className="auth-field">
              <label htmlFor="dapuros-register-email" data-testid="register-email-label">Alamat email</label>
              <input id="dapuros-register-email" type="email" name="email" autoComplete="email" required data-testid="register-email-input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@restoran.com" />
            </div>

            <div className="auth-field">
              <label htmlFor="dapuros-register-password" data-testid="register-password-label">Kata sandi</label>
              <input id="dapuros-register-password" type="password" name="new-password" autoComplete="new-password" required minLength={6} data-testid="register-password-input" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimal 6 karakter" />
            </div>

            {error && <p className="auth-error" role="alert" data-testid="register-error">{error}</p>}

            <button type="submit" disabled={loading} data-testid="register-submit-btn" className="auth-submit">
              {loading ? "Memproses..." : "Mulai Trial 14 Hari"} {!loading && <ArrowRight size={17} />}
            </button>

            <p className="auth-switch">Sudah punya akun? <Link to="/dapuros/login" data-testid="register-to-login-link">Masuk</Link></p>
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
