"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, Dropdown, Icon, Modal, SearchBox, SortMenu, StatusPill, Seg, post, useToast } from "@/components/ui";
import PartyForm, { type PartyFormValue } from "@/components/PartyForm";
import PaymentDialog, { type PayAccount, type PayParty } from "@/components/PaymentDialog";
import { fmtDate, tk, TODAY } from "@/lib/format";

type Row = {
  key: string; date: string; label: string; type: string; total: number; status: string | null;
  balance: number; remarks: string | null; ref: string | null; refKind: string | null;
};

export default function PartyDetail({
  party, balance, ledger, business, accounts, parties, categories, nextIn, nextOut,
}: {
  party: PartyFormValue & { id: string };
  balance: number;
  ledger: Row[];
  business: { name: string; phone: string | null };
  accounts: PayAccount[];
  parties: PayParty[];
  categories: string[];
  nextIn: number;
  nextOut: number;
}) {
  const router = useRouter();
  const { toast, node } = useToast();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("latest");
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pay, setPay] = useState<null | "in" | "out">(null);
  const [adjust, setAdjust] = useState(false);
  const [remind, setRemind] = useState(false);

  const receivable = balance >= 0;
  const amount = Math.abs(balance);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = ledger.filter((r) => !s || r.label.toLowerCase().includes(s) || (r.remarks || "").toLowerCase().includes(s) || String(r.total).includes(s));
    const sorted = [...list];
    if (sort === "oldest") sorted.reverse();
    if (sort === "high") sorted.sort((a, b) => b.total - a.total);
    if (sort === "low") sorted.sort((a, b) => a.total - b.total);
    return sorted;
  }, [ledger, q, sort]);

  const reminderText = `Dear ${party.name}, your due balance with ${business.name} is ${tk(amount)}. Please pay at your earliest convenience.` +
    `\nপ্রিয় ${party.name}, ${business.name}-এ আপনার বকেয়া ${tk(amount)}। অনুগ্রহ করে দ্রুত পরিশোধ করুন।` +
    (business.phone ? `\n— ${business.name} (${business.phone})` : "");
  const phoneDigits = (party.phone || "").replace(/\D/g, "");
  const waPhone = phoneDigits.startsWith("880") ? phoneDigits : phoneDigits.startsWith("0") ? "88" + phoneDigits : phoneDigits;

  function newDoc(kind: string) { router.push(`/documents/new?kind=${kind}&party=${party.id}`); }
  async function copy(text: string, msg: string) {
    try { await navigator.clipboard.writeText(text); toast(msg); } catch { toast("Could not copy"); }
  }
  async function doDelete() {
    const { ok, data } = await post("/api/parties", { op: "delete", id: party.id });
    if (!ok) { toast(data.error || "Could not delete"); return; }
    router.push("/parties"); router.refresh();
  }

  return (
    <div>
      <div className="md-head">
        <div className="who">
          <Avatar name={party.name} img={party.photo} size="lg" />
          <div style={{ minWidth: 0 }}>
            <h2>{party.name}</h2>
            <div className="sub">{party.phone || "---"}{party.category ? ` · ${party.category}` : ""} · {party.type === "supplier" ? "Supplier" : "Customer"}</div>
          </div>
        </div>
        <div className="md-bal">
          <div className="l">{amount < 0.005 ? "Settled" : receivable ? "Receivable" : "Payable"}</div>
          <div className={`v ${amount < 0.005 ? "" : receivable ? "pos" : "neg"}`}>{tk(amount)}</div>
        </div>
      </div>

      <div className="md-actions">
        <Dropdown align="left" items={[
          { label: "Edit Party", icon: "edit", onClick: () => setEditing(true) },
          { label: "Adjust Balance", icon: "swap", onClick: () => setAdjust(true) },
          { sep: true },
          { label: "Delete Party", icon: "trash", danger: true, onClick: () => setDeleting(true) },
        ]} trigger={(t) => <button className="btn" onClick={t}><Icon name="user" size={15} />Manage Party<Icon name="chevronDown" size={13} /></button>} />
        <Link className="btn btn-icon" href={`/reports/party-statement?party=${party.id}`} title="Party statement"><Icon name="statement" size={16} /></Link>
        <span style={{ flex: 1 }} />
        <Dropdown items={[
          { label: "Copy Message", icon: "copy", onClick: () => copy(reminderText, "Reminder message copied") },
          { label: "WhatsApp", icon: "whatsapp", onClick: () => window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(reminderText)}`, "_blank") },
          { label: "Set Reminder", icon: "reminder", onClick: () => setRemind(true) },
          { label: "Share Transaction Link", icon: "link", onClick: () => copy(`${location.origin}/parties/${party.id}`, "Link copied") },
        ]} trigger={(t) => <button className="btn" onClick={t}><Icon name="bell" size={15} />Send Reminder<Icon name="chevronDown" size={13} /></button>} />
      </div>

      <div className="md-sec">
        <h3>Transactions ({ledger.length})</h3>
        <div className="tools">
          <SearchBox value={q} onChange={setQ} placeholder="Search…" width={190} />
          <SortMenu value={sort} onChange={setSort} options={[
            { v: "latest", l: "Latest" }, { v: "oldest", l: "Oldest" }, { v: "high", l: "Amount: High to Low" }, { v: "low", l: "Amount: Low to High" },
          ]} />
          <Dropdown items={[
            { label: "Sales Invoice", icon: "tag", onClick: () => newDoc("sales_invoice") },
            { label: "Purchase", icon: "cart", onClick: () => newDoc("purchase_bill") },
            { label: "Payment In", icon: "arrowDown", onClick: () => setPay("in") },
            { label: "Payment Out", icon: "arrowUp", onClick: () => setPay("out") },
            { label: "Quotation", icon: "statement", onClick: () => newDoc("quotation") },
            { label: "Sales Return", icon: "swap", onClick: () => newDoc("sales_return") },
            { label: "Purchase Return", icon: "swap", onClick: () => newDoc("purchase_return") },
            { label: "Adjust Balance", icon: "percent", onClick: () => setAdjust(true) },
          ]} trigger={(t) => <button className="btn btn-primary" onClick={t}><Icon name="plus" size={15} />Add Transaction</button>} />
        </div>
      </div>

      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>Type</th><th>Date</th><th className="num">Total</th><th>Status</th><th className="num">Balance</th><th>Remarks</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const href = r.refKind === "doc" && r.ref ? `/doc/${r.ref}` : r.refKind === "payment" && r.ref ? `/receipt/${r.ref}` : null;
              return (
                <tr key={r.key} className={href ? "clickable" : ""} onClick={() => href && router.push(href)}>
                  <td>{href ? <Link className="md-type-link" href={href} onClick={(e) => e.stopPropagation()}>{r.label}</Link> : <b>{r.label}</b>}</td>
                  <td>{fmtDate(r.date)}</td>
                  <td className="num">{tk(r.total)}</td>
                  <td>{r.status ? <StatusPill status={r.status} /> : <span className="sub">--</span>}</td>
                  <td className={`num ${r.balance > 0.004 ? "pos" : r.balance < -0.004 ? "neg" : ""}`}>{tk(Math.abs(r.balance))}</td>
                  <td className="sub">{r.remarks || "--"}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="sub" style={{ textAlign: "center", padding: "2rem" }}>No transactions yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <PartyForm party={party} categories={categories} onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); toast("Party updated"); router.refresh(); }} />
      )}
      {deleting && (
        <Modal title="Delete Party" onClose={() => setDeleting(false)} width={420}
          footer={<><button className="btn" onClick={() => setDeleting(false)}>Cancel</button><button className="btn btn-danger" onClick={doDelete}>Delete</button></>}>
          <div>Delete <b>{party.name}</b>?{ledger.length > 0 && <> This party has {ledger.length} transaction(s); they will be kept but no longer linked to a party.</>}</div>
        </Modal>
      )}
      {pay && (
        <PaymentDialog kind={pay} parties={parties} accounts={accounts} nextNumber={pay === "in" ? nextIn : nextOut}
          defaults={{ partyId: party.id, amount: pay === "in" ? (receivable ? amount : null) : (!receivable ? amount : null) }}
          onClose={() => setPay(null)} onDone={() => { setPay(null); toast("Payment saved"); router.refresh(); }} />
      )}
      {adjust && <AdjustBalance partyId={party.id} onClose={() => setAdjust(false)} onDone={() => { setAdjust(false); toast("Balance adjusted"); router.refresh(); }} />}
      {remind && <SetReminder partyId={party.id} amount={amount} onClose={() => setRemind(false)} onDone={() => { setRemind(false); toast("Reminder set"); router.refresh(); }} />}
      {node}
    </div>
  );
}

function AdjustBalance({ partyId, onClose, onDone }: { partyId: string; onClose: () => void; onDone: () => void }) {
  const [kind, setKind] = useState<"receive" | "give">("receive");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(TODAY());
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  async function save() {
    const { ok, data } = await post("/api/parties", { op: "adjust_balance", id: partyId, kind, amount: Number(amount), date, note });
    if (!ok) { setErr(data.error || "Could not save"); return; }
    onDone();
  }
  return (
    <Modal title="Adjust Balance" onClose={onClose} width={440}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
      <Seg value={kind} onChange={setKind} options={[{ v: "receive", l: "Increase To Receive" }, { v: "give", l: "Increase To Give" }]} />
      <div className="field"><label className="label">Amount</label><input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></div>
      <div className="field"><label className="label">Date</label><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field"><label className="label">Remarks</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      {err && <div className="neg">{err}</div>}
    </Modal>
  );
}

function SetReminder({ partyId, amount, onClose, onDone }: { partyId: string; amount: number; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState(TODAY());
  const [note, setNote] = useState(amount ? `Collect due ${tk(amount)}` : "");
  async function save() {
    const { ok } = await post("/api/reminders", { op: "create", party_id: partyId, due_date: date, note });
    if (ok) onDone();
  }
  return (
    <Modal title="Set Reminder" onClose={onClose} width={420}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>Save Reminder</button></>}>
      <div className="field"><label className="label">Remind me on</label><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field"><label className="label">Note</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
    </Modal>
  );
}
