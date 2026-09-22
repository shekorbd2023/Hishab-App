"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, Modal, Seg, post, useToast } from "@/components/ui";
import { tk } from "@/lib/format";
import type { AcctRow } from "./data";

export function AcctIcon({ type, lg }: { type: string; lg?: boolean }) {
  const t = type === "bank" ? "bank" : type === "wallet" ? "wallet" : "cash";
  return <span className={`acct-ico ${t} ${lg ? "lg" : ""}`}><Icon name={t} size={lg ? 22 : 18} /></span>;
}

export default function AccountsShell({ accounts, children }: { accounts: AcctRow[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast, node } = useToast();
  const [adding, setAdding] = useState(false);
  const activeId = pathname.startsWith("/accounts/") ? pathname.split("/")[2] : null;
  const total = Math.round(accounts.reduce((a, x) => a + x.balance, 0) * 100) / 100;

  return (
    <div className={`two-pane ${activeId ? "has-detail" : ""}`}>
      <div className="pane-list">
        <div className="pane-head">
          <div className="md-pane-title">
            <h1>Manage Accounts ({accounts.length})</h1>
            <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}><Icon name="plus" size={14} />Add Account</button>
          </div>
          <div className="md-total"><span>Total Balance</span><b>{tk(total)}</b></div>
        </div>
        <div className="pane-body scroll-thin">
          {accounts.map((a) => (
            <Link key={a.id} href={`/accounts/${a.id}`} prefetch={false} className={`list-row ${activeId === a.id ? "active" : ""}`}>
              <AcctIcon type={a.type} />
              <div className="main">
                <div className="name">{a.name}</div>
                <div className="phone">{a.type === "bank" ? (a.account_no ? `A/C ${a.account_no}` : "Bank Account") : a.type === "wallet" ? "Wallet" : "Cash in hand"}</div>
              </div>
              <div className="right"><div className={`amt ${a.balance < 0 ? "neg" : "settled"}`}>{tk(a.balance)}</div></div>
            </Link>
          ))}
        </div>
      </div>
      <div className="pane-detail scroll-thin">{children}</div>
      {adding && (
        <AccountDialog onClose={() => setAdding(false)} onSaved={(id) => { setAdding(false); toast("Account added"); router.push(`/accounts/${id}`); router.refresh(); }} />
      )}
      {node}
    </div>
  );
}

/** Karbar "Add New Account": Bank Account | Wallet (+ Cash), bank name, holder, number, current balance. */
export function AccountDialog({ account, onClose, onSaved }: { account?: AcctRow; onClose: () => void; onSaved: (id: string) => void }) {
  const edit = !!account;
  const [type, setType] = useState<"bank" | "wallet" | "cash">((account?.type as "bank" | "wallet" | "cash") || "bank");
  const [name, setName] = useState(account?.name || "");
  const [bank, setBank] = useState(account?.bank_name || "");
  const [holder, setHolder] = useState(account?.holder || "");
  const [no, setNo] = useState(account?.account_no || "");
  const [bal, setBal] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    const display = (type === "bank" ? bank || name : name).trim();
    if (!display) { setErr(type === "bank" ? "Enter the bank name." : "Enter the account name."); return; }
    setBusy(true);
    const { ok, data } = await post<{ id: string }>("/api/accounts", {
      op: edit ? "update" : "create", id: account?.id, type, name: edit ? (name.trim() || display) : display,
      bank_name: type === "bank" ? bank.trim() || null : null, holder: holder.trim() || null, account_no: no.trim() || null,
      opening_balance: edit ? account!.opening_balance : Number(bal) || 0,
    });
    setBusy(false);
    if (!ok) { setErr(data.error || "Could not save."); return; }
    onSaved(edit ? account!.id : data.id);
  }

  return (
    <Modal title={edit ? "Edit Account" : "Add New Account"} onClose={() => !busy && onClose()} width={460} footer={
      <>
        <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : edit ? "Update Account" : "Save Account"}</button>
      </>
    }>
      <div className="field">
        <label className="label">Account Type</label>
        <Seg value={type} onChange={setType} options={[{ v: "bank", l: "Bank Account" }, { v: "wallet", l: "Wallet" }, { v: "cash", l: "Cash" }]} />
      </div>
      {type === "bank" ? (
        <>
          <div className="field">
            <label className="label">Bank Name <span className="req">*</span></label>
            <input className="input" autoFocus value={bank} placeholder="eg. Dutch Bangla Bank" onChange={(e) => setBank(e.target.value)} />
          </div>
          {edit && (
            <div className="field">
              <label className="label">Display Name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div className="form-grid">
            <div className="field">
              <label className="label">Account Holder Name</label>
              <input className="input" value={holder} onChange={(e) => setHolder(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Account Number</label>
              <input className="input" value={no} onChange={(e) => setNo(e.target.value)} />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="field">
            <label className="label">{type === "wallet" ? "Wallet Name" : "Account Name"} <span className="req">*</span></label>
            <input className="input" autoFocus value={name} placeholder={type === "wallet" ? "eg. Bkash, Nagad" : "eg. Cash"} onChange={(e) => setName(e.target.value)} />
          </div>
          {type === "wallet" && (
            <div className="field">
              <label className="label">Wallet Number</label>
              <input className="input" value={no} placeholder="01XXXXXXXXX" onChange={(e) => setNo(e.target.value)} />
            </div>
          )}
        </>
      )}
      {!edit && (
        <div className="field">
          <label className="label">Current Account Balance</label>
          <div className="input-group"><span className="prefix">Tk.</span>
            <input className="input" inputMode="decimal" value={bal} placeholder="0" onChange={(e) => setBal(e.target.value)} /></div>
        </div>
      )}
      {err && <div className="neg" style={{ fontSize: 12.5 }}>{err}</div>}
    </Modal>
  );
}
