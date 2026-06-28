import { useState } from "react";
import { CreditCard, CheckCircle2, RefreshCw, Smartphone, ShieldCheck, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { fmtIDR } from "@/api/client";

export default function EdcSimulator() {
  const [bank, setBank] = useState("BCA");
  const [tid, setTid] = useState("TID-8829102");
  const [mid, setMid] = useState("MID-DEBIT-001");
  const [cardType, setCardType] = useState("debit"); // debit or credit
  const [cardNumber, setCardNumber] = useState("4532 9012 8821 9012");
  const [amount, setAmount] = useState(150000);
  
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState("idle"); // idle, processing, success, failed
  const [authCode, setAuthCode] = useState("");

  const handleSimulatePayment = (method) => {
    setProcessing(true);
    setStatus("processing");
    setTimeout(() => {
      const randomAuth = Math.floor(100000 + Math.random() * 900000).toString();
      setAuthCode(randomAuth);
      setProcessing(false);
      setStatus("success");
    }, 2500);
  };

  const resetSimulation = () => {
    setStatus("idle");
    setAuthCode("");
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6" data-testid="edc-simulator-page">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/dapuros/app/dashboard" className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] mb-2">
            <ArrowLeft size={14} /> Kembali ke Dasbor
          </Link>
          <span className="label-tiny">Perangkat Keras Pembayaran</span>
          <h1 className="font-display text-3xl font-extrabold mt-1" data-testid="edc-simulator-title">
            Simulasi Mesin EDC Multibank
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 text-xs font-bold rounded-lg flex items-center gap-1">
            <ShieldCheck size={14} /> EDC Active Simulator
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* EDC Configuration Panel */}
        <div className="md:col-span-6 card-surface p-6 space-y-5">
          <h3 className="font-display font-bold text-lg border-b border-[hsl(var(--border))] pb-3">
            Konfigurasi Terminal EDC
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase text-[hsl(var(--muted))] mb-1.5 block">Pilih Bank Merchant</label>
              <div className="grid grid-cols-3 gap-2">
                {["BCA", "Mandiri", "BRI", "BNI", "CIMB", "Permata"].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBank(b)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      bank === b
                        ? "bg-amber-600 text-white border-amber-600 shadow-md"
                        : "border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]"
                    }`}
                    data-testid={`edc-bank-select-${b}`}
                  >
                    {b} EDC
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs font-bold uppercase text-[hsl(var(--muted))] mb-1 block">Terminal ID (TID)</label>
                <input
                  type="text"
                  value={tid}
                  onChange={(e) => setTid(e.target.value)}
                  className="w-full border border-[hsl(var(--border))] rounded-xl px-3 py-2 text-xs font-mono bg-white"
                  data-testid="edc-tid-input"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-[hsl(var(--muted))] mb-1 block">Merchant ID (MID)</label>
                <input
                  type="text"
                  value={mid}
                  onChange={(e) => setMid(e.target.value)}
                  className="w-full border border-[hsl(var(--border))] rounded-xl px-3 py-2 text-xs font-mono bg-white"
                  data-testid="edc-mid-input"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="text-xs font-bold uppercase text-[hsl(var(--muted))] mb-1 block">Tipe Kartu Simulasi</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCardType("debit")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                    cardType === "debit"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "border-[hsl(var(--border))]"
                  }`}
                  data-testid="edc-card-type-debit"
                >
                  Kartu Debit
                </button>
                <button
                  type="button"
                  onClick={() => setCardType("credit")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                    cardType === "credit"
                      ? "bg-purple-600 text-white border-purple-600"
                      : "border-[hsl(var(--border))]"
                  }`}
                  data-testid="edc-card-type-credit"
                >
                  Kartu Kredit
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-[hsl(var(--muted))] mb-1 block">Nominal Transaksi (IDR)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full border border-[hsl(var(--border))] rounded-xl px-4 py-2.5 text-base font-extrabold font-mono bg-white"
                data-testid="edc-amount-input"
              />
            </div>
          </div>
        </div>

        {/* EDC Interactive Terminal Hardware Screen Simulator */}
        <div className="md:col-span-6 flex flex-col items-center">
          <div className="w-full max-w-sm bg-slate-900 text-white p-6 rounded-3xl shadow-2xl border-4 border-slate-700 relative overflow-hidden" data-testid="edc-hardware-simulator">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <span className="text-xs font-extrabold text-amber-400 tracking-wider font-mono">{bank} EDC MULTIBANK</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono">ONLINE</span>
            </div>

            {/* EDC Screen Display */}
            <div className="my-6 p-5 bg-slate-950 rounded-2xl border border-slate-800 text-center min-h-[160px] flex flex-col items-center justify-center space-y-2">
              {status === "idle" && (
                <>
                  <p className="text-xs text-slate-400 font-medium">SILAKAN GESEK / TAP KARTU</p>
                  <p className="font-mono text-2xl font-extrabold text-amber-400">{fmtIDR(amount)}</p>
                  <p className="text-[10px] text-slate-500 font-mono">TID: {tid} | MID: {mid}</p>
                </>
              )}

              {status === "processing" && (
                <div className="space-y-3 py-2" data-testid="edc-status-processing">
                  <RefreshCw size={28} className="animate-spin text-amber-400 mx-auto" />
                  <p className="text-xs font-extrabold text-amber-300 tracking-wider">MEMPROSES TRANSAKSI...</p>
                  <p className="text-[10px] text-slate-400">MENGHUBUNGKAN KE BANK {bank}</p>
                </div>
              )}

              {status === "success" && (
                <div className="space-y-2 py-1" data-testid="edc-status-success">
                  <CheckCircle2 size={32} className="text-emerald-400 mx-auto animate-bounce" />
                  <p className="text-sm font-extrabold text-emerald-400">TRANSAKSI BERHASIL!</p>
                  <p className="text-xs font-mono text-slate-300">AUTH: <span className="font-bold text-amber-400">{authCode}</span></p>
                  <p className="text-[10px] text-slate-400 font-mono">APPROVAL CODE OK</p>
                </div>
              )}
            </div>

            {/* Hardware Interactive Action Buttons */}
            {status === "idle" && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleSimulatePayment("swipe")}
                  className="py-3 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all"
                  data-testid="edc-swipe-card-btn"
                >
                  <CreditCard size={16} /> Gesek Kartu
                </button>
                <button
                  type="button"
                  onClick={() => handleSimulatePayment("tap")}
                  className="py-3 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all"
                  data-testid="edc-tap-card-btn"
                >
                  <Smartphone size={16} /> Tap Contactless
                </button>
              </div>
            )}

            {status === "success" && (
              <button
                type="button"
                onClick={resetSimulation}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700"
                data-testid="edc-reset-btn"
              >
                Transaksi Baru
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
