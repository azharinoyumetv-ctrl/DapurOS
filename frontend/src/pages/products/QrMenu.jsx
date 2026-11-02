import { useState, useEffect } from "react";
import api, { downloadBlob } from "@/api/client";
import { Link } from "react-router-dom";
import { canManageProducts } from "@/auth/permissions";
import { useAuth } from '@/auth/AuthContext';
import { QRCodeSVG } from "qrcode.react";
import { QrCode, Printer, Download, Copy } from "lucide-react";
import { toast } from "@/components/ui/sonner";

export default function QrMenu() {
  const { user } = useAuth();
  const canManage = canManageProducts(user?.role);
  const [qrLink, setQrLink] = useState(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [qrError, setQrError] = useState('');
  const [tablesLoading,setTablesLoading]=useState(true);
  const [tableRevision,setTableRevision]=useState(0);
  const [qrRevision,setQrRevision]=useState(0);
  const [tables, setTables] = useState([]);
  const [selectedTableId, setSelectedTableId] = useState('');
  useEffect(() => {
    let active=true;setTablesLoading(true);setQrError('');
    api.get('/tables').then(({data})=>{
      if(!Array.isArray(data))throw Error('Invalid table list');
      if(active){setTables(data);setSelectedTableId(id=>data.some(table=>table.id===id)?id:data[0]?.id||'');}
    }).catch(()=>{if(active)setQrError('Daftar meja belum dapat dimuat. Periksa koneksi lalu coba lagi.');})
      .finally(()=>{if(active)setTablesLoading(false);});
    return()=>{active=false;};
  },[tableRevision]);

  const selectedTable = tables.find(t => t.id === selectedTableId) || tables[0];
  const qrUrl = qrLink?.enabled ? qrLink.url : '';
  useEffect(() => {
    let active = true;
    setQrLink(null); setQrError('');
    if (!selectedTable?.id) return;
    setQrBusy(true);
    api.get(`/tables/${selectedTable.id}/qr-link`).then(r => { if (active) setQrLink(r.data); })
      .catch(e => { if (active) setQrError(typeof e?.response?.data?.detail === 'string' ? e.response.data.detail : 'QR belum dapat dimuat. Coba pilih meja lagi.'); })
      .finally(() => { if (active) setQrBusy(false); });
    return () => { active = false; };
  }, [selectedTable?.id,qrRevision]);
  const configureQr = async (enabled, rotate = false) => {
    if (!selectedTable?.id || qrBusy) return;
    if (rotate && !window.confirm('Ganti QR meja? QR yang sudah dicetak tidak akan berlaku lagi.')) return;
    setQrBusy(true); setQrError('');
    try { const r = await api.post(`/tables/${selectedTable.id}/qr-link`, { enabled, rotate }); setQrLink(r.data); }
    catch(e) { setQrError(typeof e?.response?.data?.detail === 'string' ? e.response.data.detail : 'QR belum dapat diperbarui. Coba lagi.'); }
    finally { setQrBusy(false); }
  };

  const saveQr=()=>{
    const svg=document.querySelector('[data-testid="qr-print-card"] svg');
    if(!qrUrl||!svg)return;
    downloadBlob(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml;charset=utf-8'}),`DapurOS-QR-${selectedTable.id}.svg`);
  };

  return (
    <div className="p-6 space-y-6 text-left" data-testid="qr-menu-page">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <QrCode className="text-[hsl(var(--primary))]" /> QR Menu Meja
          </h1>
          <p className="text-xs text-[hsl(var(--muted))] mt-1">
            Siapkan QR meja untuk tamu memilih menu dan mengirim pesanan ke dapur. Pembayaran dilakukan di kasir.
          </p>
        </div>
      </div>

      <style>{`@media print{body *{visibility:hidden!important}.qr-print-card,.qr-print-card *{visibility:visible!important}.qr-print-card{position:absolute!important;left:0;top:0;width:100%!important;margin:0!important;padding:28mm!important;box-shadow:none!important;border:none!important;background:white!important;color:#241309!important}.qr-print-card svg{width:70mm;height:70mm}}`}</style>
      {tablesLoading&&<p role="status">Memuat meja…</p>}
      {!tablesLoading&&!tables.length&&<div className="card-surface p-6 space-y-3" data-testid="qr-empty"><p>{qrError||'Belum ada meja. Tambahkan meja di Kasir sebelum menyiapkan QR.'}</p>{qrError?<button className="btn-outline" onClick={()=>setTableRevision(value=>value+1)}>Coba lagi</button>:<Link className="btn-primary inline-block" to="/dapuros/app/pos">Buka Kasir</Link>}</div>}
      {!!tables.length&&<div className="grid grid-cols-12 gap-6">
        {/* Left: QR Code Generator per Table */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <div className="card-surface bg-white p-6 rounded-2xl border border-[hsl(var(--border))] shadow-sm space-y-5">
            <h2 className="font-display text-base font-bold flex items-center gap-2 border-b pb-3 border-[hsl(var(--border))]">
              <Printer size={18} className="text-amber-600" /> Pengaturan QR Standee Meja
            </h2>

            <div>
              <label htmlFor="qr-table" className="label-tiny block mb-1.5">Pilih Meja Restoran</label>
              <select id="qr-table" disabled={qrBusy} data-testid="qr-table-select"
                value={selectedTableId}
                onChange={(e) => setSelectedTableId(e.target.value)}
                className="input-field py-2 text-sm font-semibold w-full"
              >
                {tables.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="qr-print-card flex flex-col items-center justify-center p-6 bg-white rounded-2xl border text-center space-y-4" data-testid="qr-print-card">
              <span className="text-xs font-bold uppercase tracking-widest text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                {user?.store_name} · {selectedTable?.label}
              </span>

              <div className="p-4 bg-white rounded-xl shadow-xl">
                {qrUrl ? <QRCodeSVG value={qrUrl} size={180} level="H" includeMargin={true} /> : <p className="text-slate-700 text-sm max-w-[220px]">Aktifkan QR untuk meja yang dipilih sebelum mencetak.</p>}
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold">Meja: <span className="font-bold">{selectedTable?.label}</span></p>
                {qrUrl&&<p>Pindai untuk memesan. Pembayaran di kasir.</p>}
              </div>
            </div>

            {qrError && <p role="alert" className="text-sm text-red-700">{qrError} <button className="underline" onClick={()=>setQrRevision(value=>value+1)}>Coba lagi</button></p>}
            {canManage && <div className="flex flex-wrap gap-2">
              <button className="btn-primary" disabled={!selectedTable?.id || qrBusy} onClick={() => configureQr(true)} data-testid="qr-enable">{qrBusy ? 'Menyiapkan…' : qrLink?.enabled ? 'Perbarui QR' : 'Aktifkan QR meja'}</button>
              {qrLink?.enabled && <><button className="btn-outline" disabled={qrBusy} onClick={() => configureQr(false)} data-testid="qr-disable">Nonaktifkan QR</button><button className="btn-outline" disabled={qrBusy} onClick={() => configureQr(true, true)} data-testid="qr-rotate">Ganti QR</button></>}
            </div>}
            {qrUrl && <a href={qrUrl} target="_blank" rel="noreferrer nofollow" className="btn-outline block text-center" data-testid="qr-public-link">Buka menu tamu</a>}
            <p className="text-xs text-[hsl(var(--muted))]">Buka sesi meja di Kasir saat tamu duduk. Pesanan tamu masuk ke dapur dan dibayar di kasir.</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button disabled={!qrUrl} onClick={() => window.print()} className="btn-outline flex items-center justify-center gap-2 py-2.5 text-xs font-bold" data-testid="qr-print">
                <Printer size={15} /> Cetak QR meja
              </button>
              <button
                disabled={!qrUrl}
                onClick={() => {
                  // HISTORY: this used to just alert() the URL as text -- a "Salin Tautan"
                  // (Copy Link) button that never actually copied anything to the clipboard.
                  navigator.clipboard.writeText(qrUrl)
                    .then(() => toast.success("Tautan menu berhasil disalin ke clipboard."))
                    .catch(() => toast.error(`Gagal menyalin otomatis. Tautan: ${qrUrl}`));
                }}
                className="btn-primary flex items-center justify-center gap-2 py-2.5 text-xs font-bold"
              >
                <Copy size={15} /> Salin Tautan
              </button>
              <button disabled={!qrUrl||qrBusy} onClick={saveQr} className="btn-outline flex items-center gap-2" data-testid="qr-download"><Download size={15}/>Unduh QR</button>
            </div>
          </div>
        </div>
      </div>}
    </div>
  );
}
