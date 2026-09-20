"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/Providers";
import { Modal, PageHeader } from "@/components/Modal";
import { api, downloadCsv } from "@/lib/clientUtil";

type Row = { id: string; category: string | null; amount: number; date: string; note: string | null; aname: string | null; account_id: string | null };
type Ref = { id: string; name: string };
const m = (n: number, s: string) => `${s} ${(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export default function CashbookClient({ kind, rows, accounts, symbol }: { kind: "expense" | "income"; rows: Row[]; accounts: Ref[]; symbol: string }) {
  const { t } = useT();
  const router = useRouter();
  const [show, setShow] = useState(false);
  const title = kind === "expense" ? t("expense") : t("other_income");
  const total = rows.reduce((a, r) => a + r.amount, 0);

  function exportCsv() {
    downloadCsv(`${kind}.csv`, ["date", "category", "account", "amount", "note"], rows.map((r) => [r.date, r.category, r.aname, r.amount, r.note]));
  }
  async function del(id: string) {
    if (!confirm("Delete?")) return;
    const { ok } = await api("/api/cashbook", { op: "delete", kind, id });
    if (ok) router.refresh();
  }

  return (
    <div>
      <PageHeader title={title} count={rows.length}>
        <button className="btn" onClick={exportCsv}>⬇ {t("export_csv")}</button>
        <button className="btn btn-primary" onClick={() => setShow(true)}>+ {t("add")}</button>
      </PageHeader>
      <div className="card" style={{ padding: "1rem", marginBottom: ".75rem", display: "flex", justifyContent: "space-between" }}>
        <span className="text-muted">{t("total")}</span><b>{m(total, symbol)}</b>
      </div>
      <div className="card" style={{ padding: "1rem", overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>{t("date")}</th><th>{t("category")}</th><th>Account</th><th>{t("note")}</th><th style={{ textAlign: "right" }}>{t("amount")}</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="text-muted">{r.date}</td><td>{r.category || "—"}</td><td>{r.aname || "—"}</td><td className="text-muted">{r.note || "—"}</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{m(r.amount, symbol)}</td>
                <td><button className="btn btn-danger" style={{ padding: ".2rem .45rem" }} onClick={() => del(r.id)}>✕</button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="text-muted" style={{ textAlign: "center", padding: "2rem" }}>{t("no_data")}</td></tr>}
          </tbody>
        </table>
      </div>
      {show && <AddForm kind={kind} accounts={accounts} onClose={() => setShow(false)} onSaved={() => { setShow(false); router.refresh(); }} />}
    </div>
  );
}

function AddForm({ kind, accounts, onClose, onSaved }: { kind: string; accounts: Ref[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useT();
  const [f, setF] = useState({ category: "", amount: 0, date: new Date().toISOString().slice(0, 10), account_id: accounts[0]?.id || "", note: "" });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  async function save() {
    const { ok, data } = await api("/api/cashbook", { op: "create", kind, ...f, amount: Number(f.amount) });
    if (ok) onSaved(); else alert((data.error as string) || "Failed");
  }
  return (
    <Modal title={`${t("add")} ${kind === "expense" ? t("expense") : t("other_income")}`} onClose={onClose}>
      <div style={{ display: "grid", gap: ".6rem" }}>
        <div><label className="label">{t("category")}</label><input className="input" value={f.category} onChange={set("category")} /></div>
        <div><label className="label">{t("amount")}</label><input className="input" type="number" value={f.amount} onChange={set("amount")} /></div>
        <div><label className="label">Account</label><select className="input" value={f.account_id} onChange={set("account_id")}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <div><label className="label">{t("date")}</label><input className="input" type="date" value={f.date} onChange={set("date")} /></div>
        <div><label className="label">{t("note")}</label><input className="input" value={f.note} onChange={set("note")} /></div>
        <div style={{ display: "flex", gap: ".5rem", marginTop: ".4rem" }}><button className="btn btn-primary" onClick={save}>{t("save")}</button><button className="btn" onClick={onClose}>{t("cancel")}</button></div>
      </div>
    </Modal>
  );
}
