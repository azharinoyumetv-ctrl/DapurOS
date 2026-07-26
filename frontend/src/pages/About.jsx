import { useAuth } from "@/auth/AuthContext";
import { Utensils, ShieldCheck, Cpu, Building2, Mail, HelpCircle } from "lucide-react";

export default function About() {
  const { user } = useAuth();

  return (
    <div className="p-8 space-y-6" data-testid="about-page">
      <div className="flex flex-col gap-1">
        <span className="label-tiny">Tentang Aplikasi</span>
        <h1 className="font-display text-3xl font-bold mt-1" data-testid="about-title">
          Informasi Sistem
        </h1>
      </div>

      <div className="max-w-2xl grid gap-6">
        {/* Brand Card */}
        <div className="card-surface p-6 bg-gradient-to-r from-orange-500/10 to-amber-500/10 relative overflow-hidden">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Utensils className="text-orange-500" size={24} />
                <span className="font-display text-2xl font-extrabold text-orange-600">
                  DapurOS
                </span>
              </div>
              <p className="text-sm text-[hsl(var(--muted))]">
                Sistem Operasi Operasional Kafe, Restoran, & F&B Terpadu DagangOS.
              </p>
            </div>
            <span className="pill pill-success">v1.0.0 Live</span>
          </div>
          <div className="mt-6 pt-4 border-t border-[hsl(var(--border))] flex flex-col sm:flex-row justify-between gap-2 text-xs text-[hsl(var(--muted))] relative z-10">
            <span>Platform Induk: <strong>DagangOS Ecosystem</strong></span>
            <span>Wilayah: <strong>Indonesia (ID)</strong></span>
          </div>
        </div>

        {/* System Details */}
        <div className="card-surface p-6 space-y-4">
          <h2 className="font-display text-lg font-bold border-b border-[hsl(var(--border))] pb-2">
            Status Lisensi & Perangkat
          </h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))] shrink-0">
                <Building2 size={16} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[hsl(var(--muted))]">Nama Restoran / Outlet</p>
                <p className="text-sm font-semibold text-[hsl(var(--foreground))]" data-testid="about-store-name">
                  {user?.store_name || "DapurOS Master Demo Store"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))] shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[hsl(var(--muted))]">Status Lisensi</p>
                <p className="text-sm font-semibold text-emerald-600" data-testid="about-license-status">
                  Aktif & Tervalidasi (Enterprise F&B)
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))] shrink-0">
                <Cpu size={16} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[hsl(var(--muted))]">Perangkat Aktif</p>
                <p className="text-sm font-semibold text-[hsl(var(--foreground))]" data-testid="about-device">
                  POS Main Station & KDS Display
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))] shrink-0">
                <Mail size={16} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[hsl(var(--muted))]">Kontak Dukungan</p>
                <a href="mailto:contact@dagangos.com" className="text-sm font-semibold text-blue-600 hover:underline" data-testid="about-support">
                  contact@dagangos.com
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Info/Help */}
        <div className="card-surface p-5 flex items-start gap-3 text-xs text-[hsl(var(--muted))]">
          <HelpCircle size={16} className="text-orange-500 shrink-0 mt-0.5" />
          <p>
            DapurOS adalah bagian dari ekosistem <strong>DagangOS</strong> yang dikembangkan khusus untuk bisnis F&B, restoran, dan kafe di Indonesia.
          </p>
        </div>
      </div>
    </div>
  );
}
