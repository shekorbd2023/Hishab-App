"use client";
import { useState } from "react";
import { Modal, Seg, post } from "@/components/ui";
import { qty as fq, TODAY } from "@/lib/format";

/** Karbar "Adjust Stock" dialog — Add Stock / Reduce Stock with quantity, date and remarks. */
export default function StockDialog({ item, mode = "add", onClose, onDone }: {
  item: { id: string; name: string; unit: string | null; stock: number };
  mode?: "add" | "reduce"; onClose: () => void; onDone: () => void;
}) {
  const [kind, setKind] = useState<"add" | "reduce">(mode);
  const [q, setQ] = useState("");
  const [date, setDate] = useState(TODAY());
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const n = Math.abs(Number(q) || 0);
  const after = Math.round((item.stock + (kind === "add" ? n : -n)) * 1000) / 1000;
  const unit = (item.unit || "pcs").toUpperCase();

  async function save() {
    if (!n) { setErr("Enter a quantity."); return; }
    setBusy(true);
    const { ok, data } = await post("/api/items", { op: "adjust", id: item.id, qty_delta: kind === "add" ? n : -n, date, reason: note.trim() || null });
    setBusy(false);
    if (!ok) { setErr(data.error || "Could not adjust stock."); return; }
    onDone();
  }

  return (
    <Modal title="Adjust Stock" onClose={() => !busy && onClose()} width={440} footer={
      <>
        <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </>
    }>
      <div className="md-total"><span>{item.name}</span><span>Current Stock <b>{fq(item.stock)} {unit}</b></span></div>
      <Seg value={kind} onChange={setKind} options={[{ v: "add", l: "Add Stock" }, { v: "reduce", l: "Reduce Stock" }]} />
      <div className="form-grid">
        <div className="field">
          <label className="label">Quantity <span className="req">*</span></label>
          <div className="input-group has-suffix">
            <input className="input" style={{ paddingLeft: ".7rem" }} autoFocus inputMode="decimal" value={q} placeholder="0"
              onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); }} />
            <span className="suffix">{unit}</span>
          </div>
        </div>
        <div className="field">
          <label className="label">Date</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label className="label">Remarks</label>
        <input className="input" value={note} placeholder="e.g. damaged, gift, stock count" onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="sub">Stock after adjustment: <b className={after < 0 ? "neg" : ""}>{fq(after)} {unit}</b></div>
      {err && <div className="neg" style={{ fontSize: 12.5 }}>{err}</div>}
    </Modal>
  );
}
