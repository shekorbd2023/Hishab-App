"use client";
// Shared Karbar-style transaction list: Sales Invoices, Purchase Bills, Quotations, Sales Return, Purchase Return.
import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, MoreButton, Modal, StatusPill, Empty, FilterSelect, SortMenu, DateFilter, rangeFor, SearchBox, post, useToast, type DateRange, type MenuItem } from "@/components/ui";
import { fmtDate, tk } from "@/lib/format";
import { KIND, type DocKind } from "@/app/(app)/documents/kinds";
import type { DocRow } from "@/lib/editorData";

const PAGE = 100;

export default function DocList({ kind, rows: initial, prefix = "" }: { kind: DocKind; rows: DocRow[]; prefix?: string }) {
  const meta = KIND[kind];
  const router = useRouter();
  const { toast, node: toastNode } = useToast();
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const [status, setStatus] = useState("all");
  const [range, setRange] = useState<DateRange>(rangeFor("all"));
  const [sort, setSort] = useState("latest");
  const [limit, setLimit] = useState(PAGE);
  const [confirm, setConfirm] = useState<DocRow | null>(null);
  const [busy, setBusy] = useState(false);
  const isQuote = kind === "quotation";
  const newHref = `/documents/new?kind=${kind}`;

  const shown = useMemo(() => {
    const s = dq.trim().toLowerCase().replace(/^#/, "");
    const sNum = s.replace(/,/g, "");
    let list = rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (r.date < range.from || r.date > range.to) return false;
      if (!s) return true;
      return String(r.number).includes(sNum) || (prefix + r.number).toLowerCase().includes(s) ||
        (r.party || meta.cashLabel).toLowerCase().includes(s) || String(r.total).includes(sNum) || String(Math.round(r.total)).includes(sNum);
    });
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "oldest": return a.date === b.date ? a.number - b.number : a.date < b.date ? -1 : 1;
        case "amt_asc": return a.total - b.total;
        case "amt_desc": return b.total - a.total;
        default: return a.date === b.date ? b.number - a.number : a.date < b.date ? 1 : -1;
      }
    });
    return list;
  }, [rows, dq, status, range, sort, prefix, meta.cashLabel]);

  const sum = useMemo(() => shown.reduce((a, r) => ({ total: a.total + r.total, unpaid: a.unpaid + r.unpaid }), { total: 0, unpaid: 0 }), [shown]);

  async function act(op: "duplicate" | "convert", r: DocRow, to?: DocKind) {
    setBusy(true);
    const { ok, data } = await post<{ id: string }>("/api/documents", { op, id: r.id, to });
    setBusy(false);
    if (!ok) { toast(data.error || "Something went wrong"); return; }
    router.push(`/documents/${data.id}/edit`);
  }
  async function del() {
    if (!confirm) return;
    setBusy(true);
    const { ok, data } = await post("/api/documents", { op: "delete", id: confirm.id });
    setBusy(false);
    if (!ok) { toast(data.error || "Could not delete"); return; }
    setRows((rs) => rs.filter((x) => x.id !== confirm.id));
    toast(`${meta.single} #${confirm.number} deleted`);
    setConfirm(null);
    router.refresh();
  }

  function menu(r: DocRow): MenuItem[] {
    const items: MenuItem[] = [
      { label: `Edit ${meta.single}`, icon: "edit", href: `/documents/${r.id}/edit` },
      { label: "Duplicate Transaction", icon: "copy", onClick: () => act("duplicate", r) },
    ];
    if (meta.convert) items.push({ label: meta.convert.label, icon: "swap", onClick: () => act("convert", r, meta.convert!.to) });
    items.push({ sep: true }, { label: `Delete ${meta.single}`, icon: "trash", danger: true, onClick: () => setConfirm(r) });
    return items;
  }

  const head = (
    <div className="page-head">
      <div className="page-title">
        {meta.plural} <span className="count">({rows.length})</span>
        <Link href="/settings/features/transactions" className="btn btn-icon btn-sm btn-ghost" title="Transaction settings" aria-label="Transaction settings">
          <Icon name="settings" size={16} />
        </Link>
      </div>
      <Link href={newHref} className="btn btn-primary"><Icon name="plus" size={15} />{meta.create}</Link>
    </div>
  );

  if (rows.length === 0) {
    return (
      <div>
        {head}
        <div className="card">
          <Empty
            icon="statement"
            title={isQuote ? "Create your First Quotation" : `No ${meta.plural} yet`}
            text={isQuote ? "Send price quotations to customers and convert them into sales invoices in one click." : `Your ${meta.noun} will show up here once you create one.`}
            action={<Link href={newHref} className="btn btn-primary"><Icon name="plus" size={15} />{isQuote ? "Create New Quotation" : meta.create}</Link>}
          />
        </div>
        {toastNode}
      </div>
    );
  }

  return (
    <div className="dl">
      {head}
      <div className="toolbar">
        <SearchBox value={q} onChange={(v) => { setQ(v); setLimit(PAGE); }} placeholder={meta.search} width={280} />
        {!isQuote && (
          <FilterSelect value={status} onChange={(v) => { setStatus(v); setLimit(PAGE); }} options={[
            { v: "all", l: "All Status" }, { v: "paid", l: "Paid" }, { v: "unpaid", l: "Unpaid" }, { v: "partial", l: "Partially Paid" },
          ]} />
        )}
        <DateFilter value={range} onChange={(r) => { setRange(r); setLimit(PAGE); }} />
        <div className="grow" />
        <SortMenu value={sort} onChange={setSort} options={[
          { v: "latest", l: "Latest" }, { v: "oldest", l: "Oldest" }, { v: "amt_asc", l: "Amount: Low to High" }, { v: "amt_desc", l: "Amount: High to Low" },
        ]} />
      </div>

      <div className="dl-strip">
        <span><b>{shown.length}</b> {shown.length === 1 ? meta.single : meta.plural}</span>
        <span className="dl-dot" />
        <span>Total <b>{tk(sum.total)}</b></span>
        {!isQuote && (<><span className="dl-dot" /><span>Unpaid <b className={sum.unpaid > 0 ? "neg" : ""}>{tk(sum.unpaid)}</b></span></>)}
        {(q || status !== "all" || range.key !== "all") && (
          <button className="link dl-clear" onClick={() => { setQ(""); setStatus("all"); setRange(rangeFor("all")); }}>Clear filters</button>
        )}
      </div>

      <div className="table-wrap">
        <table className="tbl dl-tbl">
          <thead>
            <tr>
              <th>{meta.noLabel}</th><th>Party Name</th><th>Date</th>{!isQuote && <th>Status</th>}
              <th className="num">Total Amount</th>{!isQuote && <th className="num">Unpaid Amount</th>}
              <th style={{ textAlign: "center", width: 96 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, limit).map((r) => (
              <tr key={r.id} className="clickable" onClick={() => router.push(`/doc/${r.id}`)}>
                <td className="dl-no">{prefix}{r.number}</td>
                <td className="dl-party">{r.party || <span className="text-muted">{meta.cashLabel}</span>}</td>
                <td>{fmtDate(r.date)}</td>
                {!isQuote && <td><StatusPill status={r.status} /></td>}
                <td className="num" style={{ fontWeight: 600 }}>{tk(r.total)}</td>
                {!isQuote && <td className="num">{r.unpaid > 0.004 ? <span className="neg">{tk(r.unpaid)}</span> : <span className="text-muted">--</span>}</td>}
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="dl-act">
                    <Link href={`/doc/${r.id}`} className="btn btn-icon btn-sm btn-ghost" title={`Preview ${meta.single}`} aria-label="Preview"><Icon name="eye" size={16} /></Link>
                    <MoreButton items={menu(r)} />
                  </div>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={isQuote ? 5 : 7}><div className="empty" style={{ padding: "2.5rem 1rem" }}><h3>No {meta.noun} found</h3><div>Try a different search or filter.</div></div></td></tr>
            )}
          </tbody>
        </table>
      </div>
      {shown.length > limit && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: ".85rem" }}>
          <button className="btn" onClick={() => setLimit((l) => l + PAGE * 2)}>Load more ({shown.length - limit} more)</button>
        </div>
      )}

      {confirm && (
        <Modal title={`Delete ${meta.single}`} onClose={() => !busy && setConfirm(null)} width={420} footer={
          <>
            <button className="btn" onClick={() => setConfirm(null)} disabled={busy}>Cancel</button>
            <button className="btn btn-primary dl-del" onClick={del} disabled={busy}><Icon name="trash" size={14} />{busy ? "Deleting…" : "Delete"}</button>
          </>
        }>
          <div>
            Are you sure you want to delete <b>{meta.single} #{prefix}{confirm.number}</b>
            {confirm.party ? <> for <b>{confirm.party}</b></> : null} ({tk(confirm.total)})?
          </div>
          <div className="sub">Stock, party balance and the payment recorded with it will be reversed. This cannot be undone.</div>
        </Modal>
      )}
      {busy && !confirm && <div className="dl-busy" />}
      {toastNode}
    </div>
  );
}
