import { useEffect, useState } from "react";
import api from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import {
  ChefHat, Coffee, Clock, Check, Play, CheckCircle2,
  AlertTriangle, RefreshCw, Layers, Wifi, WifiOff
} from "lucide-react";
import { toast } from "@/components/ui/sonner";

export default function KdsScreen() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [station, setStation] = useState("all"); // all | Kitchen | Bar
  const [loading, setLoading] = useState(true);
  const [websocketConnected, setWebsocketConnected] = useState(false);

  const loadTickets = async () => {
    try {
      const qStation = station === "all" ? undefined : station;
      const res = await api.get("/kds", { params: { station: qStation } });
      
      // Play sound if new ticket count is higher than current ticket count
      if (tickets.length > 0 && res.data.length > tickets.length) {
        playBeep();
      }
      
      setTickets(res.data);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  // Browser synthetic notification sound (no static file dependencies)
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      setTimeout(() => oscillator.stop(), 250);
    } catch (err) {}
  };

  useEffect(() => {
    loadTickets();
  }, [station]);

  // WebSocket Live Sync
  useEffect(() => {
    if (!user?.store_id) return;

    let ws;
    let pollInterval;

    const connectWs = () => {
      const envUrl = process.env.REACT_APP_BACKEND_URL;
      let backendHost = "localhost:8000";
      if (envUrl && envUrl !== "undefined" && envUrl !== "") {
        backendHost = envUrl.replace(/https?:\/\//, "");
      } else if (!window.location.origin.includes("localhost")) {
        backendHost = window.location.host || "dagangos.com";
      }

      const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProto}//${backendHost}/api/ws/${user.store_id}`;

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setWebsocketConnected(true);
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "TABLE_UPDATE" || data.type === "ORDER_CREATE") {
          loadTickets();
        }
      };

      ws.onclose = () => {
        setWebsocketConnected(false);
        if (!pollInterval) {
          pollInterval = setInterval(() => {
            loadTickets();
          }, 3000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWs();

    // SLA display update ticker (runs every 30s)
    const slaInterval = setInterval(() => {
      loadTickets();
    }, 30000);

    return () => {
      if (ws) ws.close();
      if (pollInterval) clearInterval(pollInterval);
      clearInterval(slaInterval);
    };
  }, [user?.store_id, tickets.length]);

  const handleCycleStatus = async (ticketId, currentStatus) => {
    let nextStatus = "Pending";
    if (currentStatus === "Pending") nextStatus = "Cooking";
    else if (currentStatus === "Cooking") nextStatus = "Ready";
    else if (currentStatus === "Ready") nextStatus = "Served";
    
    try {
      await api.put(`/kds/${ticketId}/status`, { status: nextStatus });
      loadTickets();
    } catch (e) {
      toast.error("Gagal mengupdate status tiket");
    }
  };

  // SLA checker: returns true if pending for > 15 minutes
  const isSlaWarning = (createdAtStr) => {
    try {
      const created = new Date(createdAtStr);
      const diffMs = Date.now() - created.getTime();
      return diffMs > 15 * 60 * 1000; // 15 mins
    } catch (e) {
      return false;
    }
  };

  return (
    <div className="p-8 space-y-6 text-left" data-testid="kds-page">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <ChefHat className="text-[hsl(var(--primary))]" /> Kitchen Display System (KDS)
          </h1>
          <p className="text-xs text-[hsl(var(--muted))] mt-1">
            Pantau dan proses pesanan makanan & minuman secara real-time dari front-of-house.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] uppercase font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${websocketConnected ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
            {websocketConnected ? (
              <><Wifi size={12} /> WebSocket Aktif</>
            ) : (
              <><WifiOff size={12} /> HTTP Polling</>
            )}
          </span>
          <div className="flex rounded-lg border border-[hsl(var(--border))] p-1 bg-[hsl(var(--surface))]">
            <button
              onClick={() => setStation("all")}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${station === "all" ? "bg-[hsl(var(--primary))] text-white" : "text-[hsl(var(--muted))]"}`}
              data-testid="station-filter-all"
            >
              Semua Stasiun
            </button>
            <button
              onClick={() => setStation("Kitchen")}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${station === "Kitchen" ? "bg-[hsl(var(--primary))] text-white" : "text-[hsl(var(--muted))]"}`}
              data-testid="station-filter-kitchen"
            >
              Dapur (Makanan)
            </button>
            <button
              onClick={() => setStation("Bar")}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${station === "Bar" ? "bg-[hsl(var(--primary))] text-white" : "text-[hsl(var(--muted))]"}`}
              data-testid="station-filter-bar"
            >
              Bar (Minuman)
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-[hsl(var(--muted))]" data-testid="kds-loading">
          Memuat daftar pesanan KDS…
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {tickets
            .filter((t) => {
              if (station === "all") return true;
              const ticketStation = t.station || (t.items && t.items[0]?.station) || "Kitchen";
              return String(ticketStation).toLowerCase().includes(String(station).toLowerCase());
            })
            .map((t) => {
            const ticketStatus = t.items[0]?.status || "Pending";
            const isWarning = isSlaWarning(t.created_at) && ticketStatus !== "Ready";
            
            let cardBorder = "border-[hsl(var(--border))]";
            let statusBadge = "pill-muted";
            let actionText = "Mulai Masak";
            let ActionIcon = Play;
            
            if (ticketStatus === "Cooking") {
              cardBorder = "border-amber-300 ring-1 ring-amber-100 bg-amber-50/10";
              statusBadge = "pill-warning";
              actionText = "Tandai Siap (Ready)";
              ActionIcon = Check;
            } else if (ticketStatus === "Ready") {
              cardBorder = "border-emerald-300 ring-1 ring-emerald-100 bg-emerald-50/10";
              statusBadge = "pill-success";
              actionText = "Sajikan / Clear";
              ActionIcon = CheckCircle2;
            }
            
            if (isWarning) {
              cardBorder = "border-red-400 ring-2 ring-red-100 animate-pulse";
            }

            return (
              <div
                key={t.id}
                className={`card-surface bg-white rounded-2xl border flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md transition-shadow ${cardBorder}`}
                data-testid={`kds-ticket-${t.id}`}
              >
                {/* Ticket Header */}
                <div className="p-4 border-b border-[hsl(var(--border))] flex justify-between items-start">
                  <div>
                    <h3 className="font-display font-black text-sm">{t.table_label}</h3>
                    <span className="text-[9px] text-[hsl(var(--muted))] uppercase font-bold tracking-wider">{t.station} Station</span>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`pill text-[9px] px-1.5 py-0.5 ${statusBadge}`}>
                      {ticketStatus}
                    </span>
                    <span className="text-[10px] text-[hsl(var(--muted))] flex items-center gap-1">
                      <Clock size={11} /> {t.time_elapsed}
                    </span>
                  </div>
                </div>

                {/* Ticket Body: Items */}
                <div className="p-4 flex-1 space-y-3">
                  {t.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-start text-xs border-b border-dashed border-slate-100 pb-2 last:border-none">
                      <div>
                        <p className="font-bold text-[hsl(var(--foreground))]">{it.qty}x {it.name}</p>
                        {it.notes && (
                          <p className="text-[9px] text-amber-600 font-extrabold uppercase mt-1 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100/50 inline-block">
                            "{it.notes}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {isWarning && (
                    <div className="bg-red-50 text-red-700 p-2.5 rounded-lg border border-red-200 flex items-center gap-1.5 text-[10px] font-bold">
                      <AlertTriangle size={14} className="shrink-0" />
                      <span>SLA Alert! Pending &gt; 15 menit.</span>
                    </div>
                  )}
                </div>

                {/* Ticket Footer Action */}
                <button
                  onClick={() => handleCycleStatus(t.id, ticketStatus)}
                  className={`w-full py-3 text-xs font-bold text-center flex items-center justify-center gap-1.5 text-white transition-colors ${ticketStatus === "Pending" ? "bg-amber-600 hover:bg-amber-700" : ticketStatus === "Cooking" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-700 hover:bg-slate-800"}`}
                >
                  <ActionIcon size={13} /> {actionText}
                </button>
              </div>
            );
          })}
          
          {tickets.length === 0 && (
            <div className="col-span-full py-16 text-center text-xs text-[hsl(var(--muted))] bg-[hsl(var(--surface))]/40 border border-dashed rounded-2xl flex flex-col items-center justify-center gap-3">
              <Layers size={40} className="stroke-[1.2] text-[hsl(var(--muted))]/50" />
              <div>
                <p className="font-bold text-[hsl(var(--foreground))]">Tidak Ada Tiket Aktif</p>
                <p className="text-[10px] mt-1">Selesai! Semua pesanan stasiun ini telah disajikan.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
