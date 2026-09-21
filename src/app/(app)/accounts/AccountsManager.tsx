"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/Providers";
import { Modal, PageHeader } from "@/components/Modal";
import { api } from "@/lib/clientUtil";

type Acct = { id: string; name: string; type: string; opening_balance: number; balance: number };
const m = (n: number, s: string) => `${s} ${(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export default function AccountsManager({ accounts, total, symbol }: { accounts: Acct[]; total: number; symbol: string }) {
  const { t } = useT();
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [editing, setEditing] = useState<Acct | null>(null);

  return (
    <div>
      <PageHeader title={t("manage_accounts")} count={accounts.length}>
        <button className="btn" onClick={() => setShowTransfer(true)} disabled={accounts.length < 2}>⇄ {t("transfer")}</button>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setShowAdd(true); }}>+ {t("add_account")}</button>
      </PageHeader>

      <div className="card" style={{ padding: "1rem", marginBottom: ".75rem", display: "flex", justifyContent: "space-between" }}>
        <span className="text-muted">{t("total_balance")}</span>
        <b style={{ fontSize: "1.2rem" }}>{m(total, symbol)}</b>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: ".75rem" }}>
        {accounts.map((a) => (
          <div key={a.id} className="card" style={{ padding: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="pill pill-muted">{a.type}</span>
              <button className="btn" style={{ padding: ".15rem .45rem" }} onClick={() => { setEditing(a); setShowAdd(true); }}>✎</button>
            </div>
            <div style={{ fontWeight: 700, marginTop: ".5rem" }}>{a.name}</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, marginTop: ".25rem" }}>{m(a.balance, symbol)}</div>
          </div>
        ))}
      </div>

      {showAdd && <AccountForm account={editing} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); router.refresh(); }} />}
      {showTransfer && <TransferForm accounts={accounts} onClose={() => setShowTransfer(false)} onSaved={() => { setShowTransfer(false); router.refresh(); }} />}
    </div>
  );
}

function AccountForm({ account, onClose, onSaved }: { account: Acct | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useT();
  const [f, setF] = useState({ name: account?.name || "", type: account?.type || "cash", opening_balance: account?.opening_balance ?? 0 });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  async function save() {
    if (!f.name.trim()) return;
    const { ok, data } = await api("/api/accounts", account ? { op: "update", id: account.id, ...f } : { op: "create", ...f });
    if (ok) onSaved(); else alert((data.error as string) || "Failed");
  }
  async function del() {
    if (!account || !confirm("Delete this account?")) return;
    const { ok } = await api("/api/accounts", { op: "delete", id: account.id });
    if (ok) onSaved();
  }
  return (
    <Modal title={account ? `${t("edit")} ${t("manage_accounts")}` : t("add_account")} onClose={onClose}>
      <div style={{ display: "grid", gap: ".6rem" }}>
        <div><label className="label">{t("name")} *</label><input className="input" value={f.name} onChange={set("name")} /></div>
        <div><label className="label">{t("type")}</label>
          <select className="input" value={f.type} onChange={set("type")}>
            <option value="cash">{t("cash")}</option><option value="bank">{t("bank")}</option><option value="wallet">{t("wallet")}</option>
          </select>
        </div>
        <div><label className="label">Opening Balance</label><input className="input" type="number" value={f.opening_balance} onChange={set("opening_balance")} /></div>
        <div style={{ display: "flex", gap: ".5rem", marginTop: ".4rem" }}>
          <button className="btn btn-primary" onClick={save}>{t("save")}</button>
          <button className="btn" onClick={onClose}>{t("cancel")}</button>
          {account && <button className="btn btn-danger" style={{ marginLeft: "auto" }} onClick={del}>{t("delete")}</button>}
        </div>
      </div>
    </Modal>
  );
}

function TransferForm({ accounts, onClose, onSaved }: { accounts: Acct[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useT();
  const [f, setF] = useState({ from_account_id: accounts[0]?.id || "", to_account_id: accounts[1]?.id || "", amount: 0, date: new Date().toISOString().slice(0, 10), note: "" });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  async function save() {
    if (f.from_account_id === f.to_account_id) return alert("Choose two different accounts");
    const { ok, data } = await api("/api/accounts", { op: "transfer", ...f, amount: Number(f.amount) });
    if (ok) onSaved(); else alert((data.error as string) || "Failed");
  }
  return (
    <Modal title={t("transfer")} onClose={onClose}>
      <div style={{ display: "grid", gap: ".6rem" }}>
        <div><label className="label">From</label><select className="input" value={f.from_account_id} onChange={set("from_account_id")}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <div><label className="label">To</label><select className="input" value={f.to_account_id} onChange={set("to_account_id")}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <div><label className="label">{t("amount")}</label><input className="input" type="number" value={f.amount} onChange={set("amount")} /></div>
        <div><label className="label">{t("date")}</label><input className="input" type="date" value={f.date} onChange={set("date")} /></div>
        <div style={{ display: "flex", gap: ".5rem", marginTop: ".4rem" }}>
          <button className="btn btn-primary" onClick={save}>{t("save")}</button>
          <button className="btn" onClick={onClose}>{t("cancel")}</button>
        </div>
      </div>
    </Modal>
  );
}
