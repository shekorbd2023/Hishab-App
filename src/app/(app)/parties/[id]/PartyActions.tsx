"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/Providers";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/clientUtil";

export default function PartyActions({
  partyId, partyName, phone, balance, accounts,
}: {
  partyId: string; partyName: string; phone: string | null; balance: number;
  accounts: { id: string; name: string }[];
}) {
  const { t } = useT();
  const router = useRouter();
  const [pay, setPay] = useState(false);

  function sendReminder() {
    const msg = `Dear ${partyName}, this is a friendly reminder that ${Math.abs(balance).toLocaleString("en-US")} Tk. is ${balance >= 0 ? "due to us" : "payable by us"}. Thank you.`;
    const clean = (phone || "").replace(/[^0-9]/g, "");
    const url = clean ? `https://wa.me/${clean}?text=${encodeURIComponent(msg)}` : `sms:?body=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  return (
    <div style={{ display: "flex", gap: ".4rem", marginTop: ".9rem", flexWrap: "wrap" }}>
      <button className="btn btn-primary" onClick={() => setPay(true)}>+ Record Payment</button>
      <button className="btn" onClick={sendReminder}>🔔 {t("reminder_send")}</button>
      {pay && <PaymentModal partyId={partyId} balance={balance} accounts={accounts} onClose={() => setPay(false)} onSaved={() => { setPay(false); router.refresh(); }} />}
    </div>
  );
}

function PaymentModal({ partyId, balance, accounts, onClose, onSaved }: {
  partyId: string; balance: number; accounts: { id: string; name: string }[]; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useT();
  const [amount, setAmount] = useState(Math.abs(balance) || 0);
  const [kind, setKind] = useState<"in" | "out">(balance >= 0 ? "in" : "out");
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { ok, data } = await api("/api/payments", { op: "create", kind, party_id: partyId, account_id: accountId, amount: Number(amount), date });
    setBusy(false);
    if (ok) onSaved(); else alert((data.error as string) || "Failed");
  }

  return (
    <Modal title="Record Payment" onClose={onClose}>
      <div style={{ display: "grid", gap: ".6rem" }}>
        <div><label className="label">Direction</label>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as "in" | "out")}>
            <option value="in">Payment In (received)</option>
            <option value="out">Payment Out (paid)</option>
          </select>
        </div>
        <div><label className="label">{t("amount")}</label><input className="input" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
        <div><label className="label">Account</label>
          <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div><label className="label">{t("date")}</label><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div style={{ display: "flex", gap: ".5rem", marginTop: ".4rem" }}>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{t("save")}</button>
          <button className="btn" onClick={onClose}>{t("cancel")}</button>
        </div>
      </div>
    </Modal>
  );
}
