import { useState } from "react";
import { fmtIDR } from "@/api/client";

export default function CashReceiptConfirmation({ total, disabled, onConfirm, testId }) {
  const [amount, setAmount] = useState("");
  const received = Number(amount);
  const valid = amount !== "" && Number.isFinite(received) && received >= total && received <= 1e15;
  return (
    <form className="space-y-3" onSubmit={event => {
      event.preventDefault();
      if (valid && !disabled) onConfirm(received);
    }}>
      <label className="block text-sm">
        Jumlah uang tunai diterima (Rp)
        <input className="input-field mt-1" type="number" inputMode="decimal" min="0" max="1000000000000000" step="0.01"
          required value={amount} onChange={event => setAmount(event.target.value)} disabled={disabled} data-testid={testId + "-received"} />
      </label>
      {amount !== "" && <p className="text-sm" role="status">
        {valid ? "Kembalian " + fmtIDR(received - total) : "Jumlah tunai belum mencukupi atau tidak valid."}
      </p>}
      <button type="submit" className="btn-primary w-full" disabled={!valid || disabled} data-testid={testId + "-confirm"}>
        Konfirmasi pembayaran tunai
      </button>
    </form>
  );
}
