"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DateFilter, Dropdown, FilterSelect, Icon, Modal, MoreButton, SearchBox, SortMenu, post, rangeFor, useToast, type DateRange } from "@/components/ui";
import { fmtDate, tk, TODAY } from "@/lib/format";
import { AccountDialog, AcctIcon } from "../AccountsShell";
import type { AcctRow } from "../data";

type Row = { key: string; date: string; type: string; label: string; party: string | null; amount: number; delta: number; balance: number; remarks: string | null; ref: string | null; refKind: string | null };
type Mini = { id: string; name: string; balance: number };

const TYPES = [
  { v: "all", l: "All Transactions" }, { v: "sales_invoice", l: "Sales" }, { v: "purchase_bill", l: "Purchase" }, { v: "income", l: "Income" },
  { v: "payment_in", l: "Payment In" }, { v: "payment_out", l: "Payment Out" }, { v: "sales_return", l: "Sales Return" },
  { v: "purchase_return", l: "Purchase Return" }, { v: "expense", l: "Expense" }, { v: "add_money", l: "Add Money" },
  { v: "reduce_money", l: "Reduce Money" }, { v: "transfer", l: "Transfer Balance" },
];

function hrefOf(r: Row): string | null {
  if (!r.ref) return null;
  if (r.refKind === "doc") return `/doc/${r.ref}`;
  if (r.refKind === "payment") return `/receipt/${r.ref}`;
  if (r.refKind === "expense") return "/expense";
  if (r.refKind === "income") return "/income";
  return null;
}

export default function AccountDetail({ account, accounts, ledger }: { account: AcctRow; accounts: Mini[]; ledger: Row[] }) {
  const router = useRouter();
  const { toast, node } = useToast();
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [range, setRange] = useState<DateRange>(rangeFor("all"));
  const [sort, setSort] = useState("latest");
  const [money, setMoney] = useState<null | "add" | "reduce" | "transfer">(null);
  const [editing, setEditing] = useState(false);
  const [del, setDel] = useState(false);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const r = ledger.filter((x) => (type === "all" || x.type === type) && x.date >= range.from && x.date <= range.to &&
      (!s || x.label.toLowerCase().includes(s) || (x.party || "").toLowerCase().includes(s) || (x.remarks || "").toLowerCase().includes(s)));
    if (sort === "oldest") return [...r].reverse();
    if (sort === "amt_desc") return [...r].sort((a, b) => b.amount - a.amount);
    if (sort === "amt_asc") return [...r].sort((a, b) => a.amount - b.amount);
    return r;
  }, [ledger, q, type, range, sort]);
  const inSum = rows.reduce((a, r) => a + (r.delta > 0 ? r.delta : 0), 0);
  const outSum = rows.reduce((a, r) => a + (r.delta < 0 ? -r.delta : 0), 0);

  async function removeRow(r: Row) {
    const op = r.refKind === "adjustment" ? "delete_adjustment" : "delete_transfer";
    const { ok, data } = await post("/api/accounts", { op, id: r.ref });
    if (!ok) { toast(data.error || "Could not delete"); return; }
    toast("Entry deleted"); router.refresh();
  }
  async function removeAccount() {
    setBusy(true);
    const { ok, data } = await post("/api/accounts", { op: "delete", id: account.id });
    setBusy(false);
    if (!ok) { toast(data.error || "Could not delete"); return; }
    router.push("/accounts"); router.refresh();
  }

  const report = account.type === "cash" ? `/reports/cash-in-hand-statement?account=${account.id}` : `/reports/bank-statement?account=${account.id}`;

  return (
    <div>
      <div className="md-head">
        <div className="who">
          <AcctIcon type={account.type} lg />
          <div>
            <h2>{account.name}</h2>
            <div className="sub">
              {account.type === "bank" ? "Bank Account" : account.type === "wallet" ? "Mobile Wallet" : "Cash"}
              {account.holder ? ` · ${account.holder}` : ""}{account.account_no ? ` · ${account.account_no}` : ""}
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: ".5rem" }}>
          <Dropdown items={[
            { label: "Edit Account", icon: "edit", onClick: () => setEditing(true) },
            { label: "Delete Account", icon: "trash", danger: true, onClick: () => setDel(true) },
          ]} trigger={(t) => <button className="btn" onClick={t}>Manage Account<Icon name="chevronDown" size={14} /></button>} />
          <Dropdown items={[
            { label: "Add Money", icon: "plus", onClick: () => setMoney("add") },
            { label: "Reduce Money", icon: "minus", onClick: () => setMoney("reduce") },
            { label: "Transfer Money", icon: "swap", onClick: () => setMoney("transfer") },
          ]} trigger={(t) => <button className="btn btn-primary" onClick={t}>Adjust Balance<Icon name="chevronDown" size={14} /></button>} />
        </div>
      </div>

      <div className="md-balcard" style={{ marginTop: "1rem" }}>
        <div>
          <div className="l">Current Balance</div>
          <div className={`v ${account.balance < 0 ? "neg" : ""}`}>{tk(account.balance)}</div>
        </div>
        <Link href={report} className="btn"><Icon name="statement" size={15} />View Report</Link>
      </div>

      <div className="md-sec">
        <h3>Transactions Activity ({ledger.length})</h3>
        <div className="tools">
          <SearchBox value={q} onChange={setQ} placeholder="Search…" width={200} />
          <FilterSelect value={type} onChange={setType} options={TYPES} />
          <DateFilter value={range} onChange={setRange} />
          <SortMenu value={sort} onChange={setSort} options={[
            { v: "latest", l: "Latest" }, { v: "oldest", l: "Oldest" }, { v: "amt_desc", l: "Amount: High to Low" }, { v: "amt_asc", l: "Amount: Low to High" },
          ]} />
        </div>
      </div>
      {(type !== "all" || range.key !== "all" || q) && (
        <div className="dl-strip">
          <span><b>{rows.length}</b> entries</span><span className="dl-dot" />
          <span>Money In <b className="pos">{tk(inSum)}</b></span><span className="dl-dot" />
          <span>Money Out <b className="neg">{tk(outSum)}</b></span>
        </div>
      )}
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>Type</th><th>Date</th><th className="num">Rec/Paid Amount</th><th className="num">Balance</th><th>Remarks</th><th style={{ width: 44 }} /></tr></thead>
          <tbody>
            {rows.map((r) => {
              const href = hrefOf(r);
              const deletable = r.refKind === "adjustment" || r.refKind === "transfer";
              return (
                <tr key={r.key} className={href ? "clickable" : ""} onClick={() => href && router.push(href)}>
                  <td>
                    {href ? <Link className="md-type-link" href={href} onClick={(e) => e.stopPropagation()}>{r.label}</Link> : <b>{r.label}</b>}
                    {r.party && <div className="sub">{r.party}</div>}
                  </td>
                  <td>{fmtDate(r.date)}</td>
                  <td className={`num ${r.delta >= 0 ? "pos" : "neg"}`} style={{ fontWeight: 600 }}>{r.delta >= 0 ? "+ " : "− "}{tk(r.amount)}</td>
                  <td className="num">{tk(r.balance)}</td>
                  <td className="sub">{r.remarks || "--"}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {deletable && <MoreButton items={[{ label: "Delete Entry", icon: "trash", danger: true, onClick: () => removeRow(r) }]} />}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6}><div className="empty"><h3>No transactions found</h3><div>Payments, expenses and transfers through this account show here.</div></div></td></tr>}
          </tbody>
        </table>
      </div>

      {money && <MoneyDialog mode={money} account={account} accounts={accounts} onClose={() => setMoney(null)}
        onDone={(msg) => { setMoney(null); toast(msg); router.refresh(); }} />}
      {editing && <AccountDialog account={account} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); toast("Account updated"); router.refresh(); }} />}
      {del && (
        <Modal title="Delete Account" onClose={() => !busy && setDel(false)} width={420} footer={
          <>
            <button className="btn" onClick={() => setDel(false)} disabled={busy}>Cancel</button>
            <button className="btn btn-primary dl-del" onClick={removeAccount} disabled={busy}><Icon name="trash" size={14} />{busy ? "Deleting…" : "Delete"}</button>
          </>
        }>
          <div>Delete <b>{account.name}</b>?</div>
          <div className="sub">Payments and expenses recorded through it stay, but will no longer be linked to any account.</div>
        </Modal>
      )}
      {node}
    </div>
  );
}

function MoneyDialog({ mode, account, accounts, onClose, onDone }: {
  mode: "add" | "reduce" | "transfer"; account: AcctRow; accounts: Mini[]; onClose: () => void; onDone: (msg: string) => void;
}) {
  const others = accounts.filter((a) => a.id !== account.id);
  const [to, setTo] = useState(others[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(TODAY());
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const n = Math.abs(Number(amount) || 0);
  const title = mode === "add" ? "Add Money" : mode === "reduce" ? "Reduce Money" : "Transfer Money";

  async function save() {
    if (!n) { setErr("Enter an amount."); return; }
    if (mode === "transfer" && !to) { setErr("Choose the account to transfer to."); return; }
    setBusy(true);
    const body = mode === "transfer"
      ? { op: "transfer", from_account_id: account.id, to_account_id: to, amount: n, date, note: note.trim() || null }
      : { op: "adjust", account_id: account.id, kind: mode, amount: n, date, note: note.trim() || null };
    const { ok, data } = await post("/api/accounts", body);
    setBusy(false);
    if (!ok) { setErr(data.error || "Could not save."); return; }
    onDone(mode === "transfer" ? "Money transferred" : mode === "add" ? "Money added" : "Money reduced");
  }

  return (
    <Modal title={title} onClose={() => !busy && onClose()} width={440} footer={
      <>
        <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </>
    }>
      <div className="md-total"><span>{mode === "transfer" ? "From" : "Account"}: {account.name}</span><span>Balance <b>{tk(account.balance)}</b></span></div>
      {mode === "transfer" && (
        <div className="field">
          <label className="label">Transfer To <span className="req">*</span></label>
          <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
            {others.map((a) => <option key={a.id} value={a.id}>{a.name} ({tk(a.balance)})</option>)}
          </select>
        </div>
      )}
      <div className="form-grid">
        <div className="field">
          <label className="label">Amount <span className="req">*</span></label>
          <div className="input-group"><span className="prefix">Tk.</span>
            <input className="input" autoFocus inputMode="decimal" value={amount} placeholder="0" onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") save(); }} /></div>
        </div>
        <div className="field">
          <label className="label">Date</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label className="label">Remarks</label>
        <input className="input" value={note} placeholder="Enter remarks" onChange={(e) => setNote(e.target.value)} />
      </div>
      {n > 0 && (
        <div className="sub">
          New balance of {account.name}: <b>{tk(Math.round((account.balance + (mode === "add" ? n : -n)) * 100) / 100)}</b>
        </div>
      )}
      {err && <div className="neg" style={{ fontSize: 12.5 }}>{err}</div>}
    </Modal>
  );
}
