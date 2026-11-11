export default function TicketStationSelect({ value, onChange }) {
  return (
    <label className="block">
      <span className="label-tiny">Tujuan tiket pesanan</span>
      <select className="input-field mt-1.5" value={value} onChange={event => onChange(event.target.value)} data-testid="product-ticket-station">
        <option value="Auto">Otomatis dari kategori</option>
        <option value="Kitchen">Dapur (makanan)</option>
        <option value="Bar">Bar (minuman)</option>
      </select>
      <span className="block text-xs text-[hsl(var(--muted))] mt-1">Tentukan di mana menu ini muncul di layar pesanan.</span>
    </label>
  );
}
