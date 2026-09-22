"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import PaymentDialog, { type PayAccount, type PayParty, type PaymentEdit } from "@/components/PaymentDialog";
import { DateFilter, Empty, FilterSelect, Icon, Modal, MoreButton, SearchBox, SortMenu, post, rangeFor, useToast, type DateRange } from "@/components/ui";
import { fmtDate, tk } from "@/lib/format";

export type PayRow = PaymentEdit & { party: string | null; account: string | null };

export default function PaymentList({ kind, rows, parties, accounts, nextNumber }: {
  kind: "in" | "out"; rows: PayRow[]; parties: PayParty[]; accounts: PayAccount[]; nextNumber: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const { toast, node } = useToast();
  const isIn = kind === "in";
  const [q, setQ] = useState("");
  const [acc, setAcc] = useState("all");
  const [range, setRange] = useState<DateRange>(rangeFor("all"));
  const [sort, setSort] = useState("latest");
  const [adding, setAdding] = useState(sp.get("new") === "1");
  const [editing, setEditing] = useState<PayRow | null>(null);
  const [deleting, setDeleting] = useState<PayRow | null>(null);
  useEffect(() => { if (sp.get("new") === "1") setAdding(true); }, [sp]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = rows.filter((r) =>
      (!s || String(r.number).includes(s) || (r.party || "").toLowerCase().includes(s) || String(r.amount).includes(s) || (r.note || "").toLowerCase().includes(s)) &&
      (acc === "all" || r.account_id === acc) && r.date >= range.from && r.date <= range.to);
    const out = [...list];
    if (sort === "oldest") out.sort((a, b) => (a.date === b.date ? a.number - b.number : a.date < b.date ? -1 : 1));
    else if (sort === "low") out.sort((a, b) => a.amount - b.amount);
    else if (sort === "high") out.sort((a, b) => b.amount - a.amount);
    else out.sort((a, b) => (a.date === b.date ? b.number - a.number : a.date < b.date ? 1 : -1));
    return out;
  }, [rows, q, acc, range, sort]);
  const total = shown.reduce((a, r) => a + r.amount, 0);
  const label = isIn ? "Payment In" : "Payment Out";
  const closeAdd = () => { setAdding(false); if (sp.get("new")) router.replace(pathname); };

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">{label} <span className="count">({rows.length})</span></h1>
        <button className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" size={15} />Add {label}</button>
      </div>
      {rows.length === 0 ? (
        <div className="card"><Empty icon="wallet" title={`No ${label} yet`} text={isIn ? "Record money you receive from customers against their dues." : "Record money you pay to suppliers against their bills."}
          action={<button className="btn btn-primary" onClick={() => setAdding(true)}>Add {label}</button>} /></div>
      ) : (
        <>
          <div className="toolbar">
            <SearchBox value={q} onChange={setQ} placeholder={`Search ${label}…`} width={240} />
            <FilterSelect value={acc} onChange={setAcc} options={[{ v: "all", l: "All Payment Modes" }, ...accounts.map((a) => ({ v: a.id, l: a.name }))]} />
            <DateFilter value={range} onChange={setRange} />
            <span className="grow" />
            <span className="sub">{shown.length} entries · <b style={{ color: "var(--text)" }}>{tk(total)}</b></span>
            <SortMenu value={sort} onChange={setSort} options={[{ v: "latest", l: "Latest" }, { v: "oldest", l: "Oldest" }, { v: "low", l: "Amount: Low to High" }, { v: "high", l: "Amount: High to Low" }]} />
          </div>
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Receipt No</th><th>Party Name</th><th>Date</th><th>Payment Mode</th><th className="num">Amount</th><th>Remarks</th><th style={{ width: 90 }}>Action</th></tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="clickable" onClick={() => router.push(`/receipt/${r.id}`)}>
                    <td><b>{r.number}</b></td>
                    <td>{r.party || "--"}</td>
                    <td>{fmtDate(r.date)}</td>
                    <td>{r.account || "--"}</td>
                    <td className={`num ${isIn ? "pos" : "neg"}`}><b>{tk(r.amount)}</b></td>
                    <td className="sub">{r.note || "--"}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="row" style={{ gap: 2 }}>
                        <Link href={`/receipt/${r.id}`} className="btn btn-icon btn-sm btn-ghost" title="Preview receipt"><Icon name="eye" size={15} /></Link>
                        <MoreButton items={[
                          { label: "Preview / Print", icon: "printer", href: `/receipt/${r.id}` },
                          { label: "Edit", icon: "edit", onClick: () => setEditing(r) },
                          { sep: true },
                          { label: "Delete", icon: "trash", danger: true, onClick: () => setDeleting(r) },
                        ]} />
                      </div>
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={7} className="sub" style={{ textAlign: "center", padding: "2rem" }}>No payments match your filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
      {adding && (
        <PaymentDialog kind={kind} parties={parties} accounts={accounts} nextNumber={nextNumber} onClose={closeAdd}
          defaults={{ partyId: sp.get("party") }}
          onDone={(r) => { if (r.again) { toast("Saved"); router.refresh(); return; } closeAdd(); router.push(`/receipt/${r.id}`); }} />
      )}
      {editing && (
        <PaymentDialog kind={kind} parties={parties} accounts={accounts} edit={editing}
          onClose={() => setEditing(null)} onDone={() => { setEditing(null); toast("Payment updated"); router.refresh(); }} />
      )}
      {deleting && (
        <Modal title={`Delete ${label} #${deleting.number}`} onClose={() => setDeleting(null)} width={420}
          footer={<><button className="btn" onClick={() => setDeleting(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={async () => {
              const { ok, data } = await post("/api/payments", { op: "delete", id: deleting.id });
              if (!ok) { toast(data.error || "Could not delete"); return; }
              setDeleting(null); toast("Deleted"); router.refresh();
            }}>Delete</button></>}>
          <div>Delete {label} #{deleting.number} of {tk(deleting.amount)}{deleting.party ? ` from ${deleting.party}` : ""}?</div>
        </Modal>
      )}
      {node}
    </div>
  );
}
