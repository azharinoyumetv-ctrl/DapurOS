import { useEffect, useRef, useState } from "react";
import { id as indonesian } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import api from "@/api/client";

const statuses = { booked: "Terjadwal", seated: "Sudah ditempatkan", cancelled: "Dibatalkan", no_show: "Tidak hadir" };
const dateKey = date => [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(n => String(n).padStart(2, "0")).join("-");
const calendarDate = value => new Date(value + "T12:00:00");
const message = (error, fallback) => typeof error?.response?.data?.detail === "string" ? error.response.data.detail : fallback;

function localDateTime(value, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const field = name => parts.find(part => part.type === name)?.value;
  return `${field("year")}-${field("month")}-${field("day")}T${field("hour")}:${field("minute")}`;
}

function displayTime(value, timeZone, day) {
  const local = localDateTime(value, timeZone);
  return local.startsWith(day) ? local.slice(11) : `${local.slice(8, 10)}/${local.slice(5, 7)} ${local.slice(11)}`;
}

export default function ReservationCalendar({ canBook, initialTableId, floors, onClose, onSeated, onChanged }) {
  const [day, setDay] = useState(null);
  const [agenda, setAgenda] = useState(null);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null);
  const [availability, setAvailability] = useState({ key: "", tables: null, error: "" });
  const attempt = useRef(null);
  const lock = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    let requestInFlight = false;
    const load = async (background = false) => {
      if (requestInFlight || (background && document.hidden)) return;
      requestInFlight = true;
      if (!background) setLoading(true);
      try {
        const { data } = await api.get("/tables/schedule", { params: day ? { day } : {}, signal: controller.signal, timeout: 12000 });
        if (controller.signal.aborted) return;
        setAgenda(data);
        setReadError("");
      } catch (error) {
        if (!controller.signal.aborted && !background) setReadError(message(error, "Kalender belum dapat dimuat. Coba lagi."));
      } finally {
        requestInFlight = false;
        if (!controller.signal.aborted && !background) setLoading(false);
      }
    };
    load();
    const interval = setInterval(() => load(true), 30000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [day, revision]);

  const slotKey = form ? JSON.stringify([form.local_start, Number(form.duration_minutes), Number(form.party_size), form.id || null]) : "";
  useEffect(() => {
    if (!slotKey) return;
    const [local_start, duration_minutes, party_size, exclude] = JSON.parse(slotKey);
    if (!local_start || duration_minutes < 15 || duration_minutes > 480 || party_size < 1 || party_size > 1000) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/tables/schedule/availability", {
          params: { local_start, duration_minutes, party_size, exclude }, signal: controller.signal, timeout: 8000,
        });
        if (!controller.signal.aborted) setAvailability({ key: slotKey, tables: data, error: "" });
      } catch (error) {
        if (!controller.signal.aborted) setAvailability({ key: slotKey, tables: null, error: message(error, "Ketersediaan belum dapat diperiksa.") });
      }
    }, 220);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [slotKey, revision]);

  const refresh = () => setRevision(current => current + 1);
  const navigateDay = value => {
    if (value !== day) {
      setDay(value);
      setReadError("");
    }
    setActionError("");
  };
  const startForm = booking => {
    const next = localDateTime(new Date(Date.parse(agenda.server_now) + 15 * 60000), agenda.timezone);
    const localStart = agenda.day === agenda.today ? next : agenda.day + "T18:00";
    setActionError("");
    attempt.current = null;
    setForm(booking ? {
      id: booking.id, expected_version: booking.version, table_id: booking.table_id, customer_name: booking.customer_name,
      phone: booking.phone, party_size: booking.party_size, note: booking.note, duration_minutes: booking.duration_minutes,
      local_start: localDateTime(booking.start_at, agenda.timezone), originalStart: localDateTime(booking.start_at, agenda.timezone),
    } : {
      table_id: initialTableId || "", customer_name: "", phone: "", party_size: 2, note: "",
      duration_minutes: 90, local_start: localStart,
    });
  };

  const run = async operation => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setActionError("");
    try {
      await operation();
    } catch (error) {
      setActionError(message(error, "Perubahan belum dapat disimpan. Periksa koneksi dan coba lagi."));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const save = event => {
    event.preventDefault();
    run(async () => {
      const { id, originalStart, ...draft } = form;
      const payload = { ...draft, party_size: Number(draft.party_size), duration_minutes: Number(draft.duration_minutes) };
      const fingerprint = JSON.stringify(payload);
      if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, id: crypto.randomUUID() };
      const body = { ...payload, request_id: attempt.current.id };
      if (id) await api.put(`/tables/schedule/${id}`, body, { timeout: 12000 });
      else await api.post("/tables/schedule", body, { timeout: 12000 });
      setForm(null);
      navigateDay(payload.local_start.slice(0, 10));
      refresh();
      onChanged();
    });
  };

  const closeBooking = (booking, status) => {
    const question = status === "cancelled" ? "Batalkan reservasi" : "Tandai tidak hadir";
    if (!window.confirm(`${question} untuk ${booking.customer_name}?`)) return;
    run(async () => {
      await api.post(`/tables/schedule/${booking.id}/close`, { expected_version: booking.version, status }, { timeout: 12000 });
      refresh();
      onChanged();
    });
  };

  const seat = (booking, table) => run(async () => {
    await api.post(`/tables/${table.id}/session`, {
      scheduled_reservation_id: booking.id, expected_version: booking.version,
    }, { timeout: 12000 });
    onSeated(table);
  });

  const setField = (field, value) => setForm(current => ({ ...current, [field]: value }));
  const selectedDay = day || agenda?.today || dateKey(new Date());
  const selected = calendarDate(selectedDay);
  const agendaReady = agenda?.day === selectedDay;
  const monthMarkers = agenda?.day.slice(0, 7) === selectedDay.slice(0, 7) ? agenda.marked_days : [];
  const now = agenda ? Date.parse(agenda.server_now) : 0;
  const selectedTable = form && agenda?.tables.find(table => table.id === form.table_id);
  const minStart = agenda && localDateTime(agenda.server_now, agenda.timezone);
  const slot = availability.key === slotKey ? availability : null;
  const tableIssue = slot?.tables?.[form?.table_id];
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-w-4xl w-[calc(100%-1rem)] max-h-[92dvh] overflow-y-auto rounded-xl bg-[hsl(var(--background))] p-4 sm:p-6" data-testid="reservation-calendar">
      <header className="pr-8">
        <span className="pill pill-muted">Business</span>
        <DialogTitle className="font-display text-xl mt-2">Kalender Reservasi</DialogTitle>
        <DialogDescription className="text-sm mt-1">Jadwalkan kedatangan tamu dan pilih meja untuk setiap reservasi.</DialogDescription>
      </header>
      {readError && <div role="alert" className="text-sm space-x-2">{readError}<button className="btn-outline" onClick={refresh}>Coba lagi</button></div>}
      {actionError && <div role="alert" className="text-sm text-red-700" data-testid="calendar-action-error">{actionError}</div>}
      <div className="grid gap-4 md:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="card-surface p-2 self-start">
          <Calendar mode="single" required locale={indonesian} weekStartsOn={1} month={selected} selected={selected}
            disableNavigation={Boolean(form || busy)} disabled={Boolean(form || busy)}
            labels={{ labelPrevious: () => "Bulan sebelumnya", labelNext: () => "Bulan berikutnya" }}
            onSelect={value => value && navigateDay(dateKey(value))}
            onMonthChange={value => navigateDay(dateKey(new Date(value.getFullYear(), value.getMonth(), 1)))}
            today={agenda ? calendarDate(agenda.today) : undefined} modifiers={{ booked: monthMarkers.map(calendarDate) }}
            modifiersClassNames={{ booked: "underline decoration-amber-600 decoration-2 underline-offset-4" }} />
          <div className="flex flex-wrap items-center justify-between gap-2 p-2">
            <button className="btn-outline text-xs" disabled={!agenda || Boolean(form) || busy} onClick={() => navigateDay(agenda.today)}>Hari ini</button>
            {agenda && <span className="text-xs" data-testid="calendar-timezone">{agenda.timezone}</span>}
          </div>
        </aside>
        <section className="space-y-3 min-w-0">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <h3 className="font-bold" data-testid="calendar-agenda-day">{selected.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h3>
            {agendaReady && !form && <button type="button" className="btn-primary text-sm" data-testid="calendar-new"
              disabled={!canBook || busy || loading || Boolean(readError) || agenda.day < agenda.today || !agenda.tables.length}
              onClick={() => startForm()}>{canBook ? "Reservasi baru" : "Reservasi baru · Business"}</button>}
          </div>
          {(loading || (!agendaReady && !readError)) && <p role="status" className="text-sm">Memuat jadwal…</p>}
          {agendaReady && (form ? <form className="card-surface p-3 space-y-3" onSubmit={save} data-testid="calendar-booking-form">
            <h4 className="font-bold">{form.id ? "Ubah jadwal" : "Reservasi baru"}</h4>
            <label className="block text-sm">Meja<select className="input-field block w-full mt-1" required value={form.table_id} onChange={e => setField("table_id", e.target.value)} data-testid="calendar-table">
              <option value="">Pilih meja</option>
              {agenda.tables.map(table => <option key={table.id} value={table.id} disabled={Boolean(slot?.tables?.[table.id]) && form.table_id !== table.id}>
                {table.label} · {floors.find(floor => floor.id === table.floor_id)?.name || "Lantai"} · {table.capacity} kursi{slot?.tables?.[table.id] ? " · " + slot.tables[table.id] : ""}
              </option>)}
            </select></label>
            {(tableIssue || slot?.error) && <p role="status" className="text-sm text-amber-800" data-testid="calendar-availability">{tableIssue || slot.error}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">Tanggal dan jam<input className="input-field block w-full mt-1 min-w-0" type="datetime-local" required min={form.originalStart && form.originalStart < minStart ? form.originalStart : minStart}
                value={form.local_start} onChange={e => setField("local_start", e.target.value)} data-testid="calendar-start" /></label>
              <label className="block text-sm">Durasi (menit)<input className="input-field block w-full mt-1" type="number" required min={15} max={480}
                value={form.duration_minutes} onChange={e => setField("duration_minutes", e.target.value)} data-testid="calendar-duration" /></label>
              <label className="block text-sm">Nama pelanggan<input className="input-field block w-full mt-1" required maxLength={200}
                value={form.customer_name} onChange={e => setField("customer_name", e.target.value)} data-testid="calendar-name" /></label>
              <label className="block text-sm">Jumlah tamu<input className="input-field block w-full mt-1" type="number" required min={1} max={selectedTable?.capacity || 1000}
                value={form.party_size} onChange={e => setField("party_size", e.target.value)} data-testid="calendar-party" /></label>
            </div>
            <label className="block text-sm">Telepon (opsional)<input className="input-field block w-full mt-1" type="tel" maxLength={64} value={form.phone} onChange={e => setField("phone", e.target.value)} /></label>
            <label className="block text-sm">Catatan (opsional)<textarea className="input-field block w-full mt-1" maxLength={1000} value={form.note} onChange={e => setField("note", e.target.value)} /></label>
            <div className="flex gap-2 flex-wrap">
              <button className="btn-primary" disabled={busy || !canBook || Boolean(tableIssue)} data-testid="calendar-save">Simpan reservasi</button>
              <button className="btn-outline" type="button" disabled={busy} onClick={() => { setForm(null); setActionError(""); }}>Batal</button>
            </div>
          </form> : <>
            {!agenda.bookings.length && <p className="card-surface p-4 text-sm">Belum ada reservasi untuk tanggal ini.</p>}
            {agenda.bookings.map(booking => {
              const start = Date.parse(booking.start_at), end = Date.parse(booking.end_at);
              const table = agenda.tables.find(row => row.id === booking.table_id);
              const booked = booking.status === "booked";
              const canSeat = booked && now >= start - 15 * 60000 && now < end && table?.status === "Vacant";
              return <article key={booking.id} className="card-surface p-3 space-y-2 break-words" data-testid={`calendar-booking-${booking.id}`}>
                <div className="flex flex-wrap gap-2 items-center justify-between">
                  <p className="font-bold">{booking.customer_name}</p>
                  <span className="pill pill-muted">{booked && now >= end ? "Jadwal lewat" : statuses[booking.status]}</span>
                </div>
                <p className="text-sm">{displayTime(booking.start_at, agenda.timezone, agenda.day)} – {displayTime(booking.end_at, agenda.timezone, agenda.day)} · {booking.table_label} · {booking.party_size} tamu</p>
                {booking.phone && <p className="text-sm">{booking.phone}</p>}
                {booking.note && <p className="text-sm whitespace-pre-wrap">{booking.note}</p>}
                {booked && <div className="flex flex-wrap gap-2">
                  {now >= start - 15 * 60000 && now < end && <button className="btn-primary text-xs" disabled={busy || loading || !canSeat} onClick={() => seat(booking, table)} data-testid={`calendar-seat-${booking.id}`}>Tempatkan tamu</button>}
                  {now < end && table && canBook && <button className="btn-outline text-xs" disabled={busy || loading} onClick={() => startForm(booking)} data-testid={`calendar-edit-${booking.id}`}>Ubah jadwal</button>}
                  <button className="btn-outline text-xs" disabled={busy || loading} onClick={() => closeBooking(booking, "cancelled")} data-testid={`calendar-cancel-${booking.id}`}>Batalkan</button>
                  {now >= start && <button className="btn-outline text-xs" disabled={busy || loading} onClick={() => closeBooking(booking, "no_show")}>Tidak hadir</button>}
                </div>}
              </article>;
            })}
          </>)}
        </section>
      </div>
    </DialogContent>
  </Dialog>;
}
