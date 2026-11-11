import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import api, { fmtIDR } from "@/api/client";

export default function TableGatewayPayment({ tableId, payment, onStatus, onClose }) {
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const stopped = useRef(false);
  const pendingRequests = useRef(0);
  const resolved = useRef(false);
  useEffect(() => { stopped.current = false; return () => { stopped.current = true; }; }, []);
  const check = async (manual = false) => {
    if (resolved.current || (!manual && pendingRequests.current)) return;
    pendingRequests.current++;
    if (manual) setChecking(true);
    try {
      const path = `/tables/${tableId}/gateway-payment/${payment.id}`;
      const { data } = manual ? await api.post(path + "/refresh") : await api.get(path);
      if (stopped.current || resolved.current) return;
      if (data.payment_status !== "pending") resolved.current = true;
      if (manual || data.payment_status !== "pending") setError("");
      onStatus(data);
    } catch (error) {
      if (manual && !stopped.current && !resolved.current) setError(typeof error.response?.data?.detail === "string" ? error.response.data.detail : "Status belum dapat diperiksa. Periksa koneksi dan coba lagi.");
    } finally {
      pendingRequests.current--;
      if (manual && !stopped.current) setChecking(false);
    }
  };
  useEffect(() => {
    if (payment.payment_status !== "pending") return;
    const poll = () => check();
    const interval = setInterval(poll, 4000);
    window.addEventListener("focus", poll);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", poll);
    };
  }, [tableId, payment.id, payment.payment_status, onStatus]);

  const status = payment.payment_status;
  const url = payment.gateway_checkout_url || payment.doku_checkout_url || payment.xendit_checkout_url;
  const safeLink = typeof url === "string" && /^https:\/\//i.test(url);
  const initialization = payment.payment_initialization;
  return <section className="space-y-4" data-testid="table-gateway-payment">
    <p className="text-sm font-bold">Tagihan: {fmtIDR(payment.total)}</p>
    {status === "pending" ? <>
      <p role="status" data-testid="table-gateway-status">Menunggu konfirmasi gateway. Meja tetap terbuka sampai pembayaran diterima.</p>
      {safeLink && <a className="btn-primary block text-center" href={url} target="_blank" rel="noreferrer" data-testid="table-gateway-open">Buka halaman pembayaran</a>}
      {payment.xendit_qr_string && <div className="text-center"><QRCodeSVG value={payment.xendit_qr_string} size={176} className="mx-auto" /><p>Pindai kode QR untuk membayar.</p></div>}
      {initialization === "initializing" && <p className="text-sm">Menyiapkan pembayaran. Tunggu hingga tautan tersedia.</p>}
      {initialization === "uncertain" && <p role="alert" className="text-sm">Status gateway belum pasti. Periksa transaksi di akun merchant dengan referensi <b>{payment.reference}</b> sebelum menerima pembayaran lain.</p>}
      <button type="button" className="btn-outline w-full" onClick={() => check(true)} disabled={checking} data-testid="table-gateway-refresh">Periksa status</button>
    </> : <p role="status" data-testid="table-gateway-status">
      {status === "paid" ? "Pembayaran diterima. Meja sudah ditutup." : status === "refunded" ? "Pembayaran sudah dikembalikan." : "Pembayaran gagal atau kedaluwarsa. Tagihan masih terbuka."}
    </p>}
    {error && <p role="alert" className="text-sm">{error}</p>}
    <button type="button" className="btn-ghost w-full" onClick={onClose}>{status === "pending" ? "Tutup sementara" : "Kembali ke meja"}</button>
  </section>;
}
