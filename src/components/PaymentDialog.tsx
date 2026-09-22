"use client";
// Karbar "Add Payment In" / "Add Payment Out" dialog. Reusable from any screen:
//   <PaymentDialog kind="in" parties={[{id,name,phone,balance}]} accounts={[{id,name}]}
//      defaults={{ partyId, amount, documentId }} onClose={...} onDone={(r) => ...} />
// Without onDone it navigates to the money receipt (/receipt/[id]) after "Save Payment In".
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal, Picker, ImageAttach, Icon, post, type PickOption } from "./ui";
import { tk, TODAY } from "@/lib/format";

export type PayParty = { id: string; name: string; phone?: string | null; balance: number };
export type PayAccount = { id: string; name: string; type?: string };
export type PaymentEdit = {
  id: string; number: number; date: string; party_id: string | null; account_id: string | null;
  amount: number; note: string | null; images?: string | null; document_id?: string | null;
};

export default function PaymentDialog({
  kind, parties, accounts, defaults, nextNumber, edit, onClose, onDone,
}: {
  kind: "in" | "out";
  parties: PayParty[];
  accounts: PayAccount[];
  defaults?: { partyId?: string | null; amount?: number | null; documentId?: string | null; accountId?: string | null; date?: string };
  nextNumber?: number;
  edit?: PaymentEdit | null;
  onClose: () => void;
  onDone?: (r: { id: string; number: number; again: boolean }) => void;
}) {
  const router = useRouter();
  const isIn = kind === "in";
  const label = isIn ? "Payment In" : "Payment Out";

  const firstAccount = accounts.find((a) => a.type === "cash")?.id || accounts[0]?.id || "";
  const blank = () => ({
    number: edit ? String(edit.number) : nextNumber ? String(nextNumber) : "",
    date: edit?.date || defaults?.date || TODAY(),
    party: edit ? edit.party_id : defaults?.partyId || null,
    amount: edit ? String(edit.amount) : defaults?.amount ? String(Math.round(defaults.amount * 100) / 100) : "",
    account: edit ? edit.account_id || "" : defaults?.accountId || firstAccount,
    note: edit?.note || "",
    images: (() => { try { return edit?.images ? (JSON.parse(edit.images) as string[]) : []; } catch { return []; } })(),
  });
  const [f, setF] = useState(blank);
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  // Auto receipt number when the caller didn't pass one.
  async function peek() {
    const { ok, data } = await post<{ number: number }>("/api/payments", { op: "peek", kind });
    if (ok && data.number) setF((s) => ({ ...s, number: String(data.number) }));
  }
  useEffect(() => { if (!edit && !nextNumber) peek(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const options: PickOption[] = useMemo(() => parties.map((p) => ({
    id: p.id, label: p.name, sub: p.phone || undefined,
    right: Math.abs(p.balance) < 0.005 ? tk(0) : tk(Math.abs(p.balance)),
    rightTone: p.balance > 0.004 ? "pos" : p.balance < -0.004 ? "neg" : undefined,
  })), [parties]);
  const party = parties.find((p) => p.id === f.party) || null;

  async function save(again: boolean) {
    setErr(null);
    const amount = Number(f.amount);
    if (!f.party) return setErr("Select a party.");
    if (!(amount > 0)) return setErr(`Enter the ${isIn ? "received" : "paid"} amount.`);
    if (!f.account) return setErr("Select a payment method.");
    setBusy(true);
    const body = {
      op: edit ? "update" : "create", id: edit?.id, kind, party_id: f.party, account_id: f.account,
      document_id: edit ? edit.document_id ?? null : defaults?.documentId ?? null,
      amount, date: f.date, note: f.note.trim() || null,
      number: manual || edit ? Number(f.number) || null : null, images: f.images,
    };
    const { ok, data } = await post<{ id: string; number: number }>("/api/payments", body);
    setBusy(false);
    if (!ok) return setErr(data.error || "Could not save the payment.");
    const res = { id: edit ? edit.id : data.id, number: edit ? Number(f.number) : data.number, again };
    if (again && !edit) {
      setSavedNote(`${label} #${res.number} saved.`);
      setManual(false);
      setF({ ...blank(), party: null, amount: "", note: "", images: [], number: "" });
      peek();
      router.refresh();
      onDone?.(res);
      return;
    }
    if (onDone) onDone(res);
    else { router.push(`/receipt/${res.id}`); router.refresh(); }
  }

  const footer = (
    <>
      {!edit && <button type="button" className="btn" disabled={busy} onClick={() => save(true)}>Save &amp; New</button>}
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => save(false)}>
        {busy ? "Saving…" : edit ? "Update Payment" : `Save ${label}`}
      </button>
    </>
  );

  return (
    <Modal title={edit ? `Edit ${label} #${edit.number}` : `Add ${label}`} onClose={onClose} footer={footer} width={560}>
      {savedNote && <div className="pd-saved"><Icon name="check" size={14} />{savedNote}</div>}
      <div className="form-grid">
        <div className="field">
          <label className="label" htmlFor="pd-no">
            <span className="between"><span>Receipt Number</span>
              {!edit && <button type="button" className="pd-manual" onClick={() => setManual((m) => !m)}>{manual ? "Auto" : "Manual"}</button>}
            </span>
          </label>
          <input id="pd-no" className="input" inputMode="numeric" value={f.number} disabled={!manual && !edit}
            onChange={(e) => setF({ ...f, number: e.target.value.replace(/[^\d]/g, "") })} />
        </div>
        <div className="field">
          <label className="label" htmlFor="pd-date">Date</label>
          <input id="pd-date" className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </div>
      </div>

      <div className="field">
        <label className="label">Party Name <span className="req">*</span></label>
        <Picker value={f.party} options={options} onChange={(id) => setF({ ...f, party: id })} placeholder="Search party…" autoFocus={!f.party} />
        {party && (
          <div className={`pd-bal ${party.balance > 0.004 ? "pos" : party.balance < -0.004 ? "neg" : ""}`}>
            Balance: {tk(Math.abs(party.balance))} {party.balance > 0.004 ? "· To Receive" : party.balance < -0.004 ? "· To Give" : "· Settled"}
          </div>
        )}
      </div>

      <div className="form-grid">
        <div className="field">
          <label className="label" htmlFor="pd-amt">{isIn ? "Received Amount" : "Paid Amount"} <span className="req">*</span></label>
          <div className="input-group">
            <span className="prefix">Tk.</span>
            <input id="pd-amt" className="input" inputMode="decimal" placeholder="0" value={f.amount} autoFocus={!!f.party}
              onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") })}
              onKeyDown={(e) => { if (e.key === "Enter") save(false); }} />
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="pd-acc">Payment Method</label>
          <select id="pd-acc" className="input" value={f.account} onChange={(e) => setF({ ...f, account: e.target.value })}>
            {accounts.length === 0 && <option value="">No accounts</option>}
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="pd-note">Remarks</label>
        <textarea id="pd-note" className="input" rows={2} placeholder="Enter remarks" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      </div>

      <div className="field">
        <label className="label">Attach Image</label>
        <ImageAttach images={f.images} onChange={(images) => setF({ ...f, images })} max={3} />
      </div>

      {err && <div className="pd-err">{err}</div>}
    </Modal>
  );
}
