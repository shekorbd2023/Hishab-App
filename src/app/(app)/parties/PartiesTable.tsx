"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/components/Providers";
import { Modal, PageHeader } from "@/components/Modal";
import { api, downloadCsv } from "@/lib/clientUtil";

type Party = {
  id: string; name: string; phone: string | null; type: string;
  category: string | null; opening_balance: number; address: string | null; note: string | null; balance: number;
};

function money(n: number, s: string) {
  const v = Math.abs(n);
  const str = v.toLocaleString("en-US", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return `${s} ${str}`;
}

export default function PartiesTable({ parties, symbol }: { parties: Party[]; symbol: string }) {
  const { t } = useT();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "receivable" | "payable" | "customer" | "supplier">("all");
  const [editing, setEditing] = useState<Party | null>(null);
  const [showForm, setShowForm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    return parties.filter((p) => {
      if (q && !(p.name.toLowerCase().includes(q.toLowerCase()) || (p.phone || "").includes(q))) return false;
      if (filter === "receivable") return p.balance > 0;
      if (filter === "payable") return p.balance < 0;
      if (filter === "customer") return p.type === "customer" || p.type === "both";
      if (filter === "supplier") return p.type === "supplier" || p.type === "both";
      return true;
    });
  }, [parties, q, filter]);

  function exportCsv() {
    downloadCsv(
      "parties.csv",
      ["name", "phone", "address", "type", "category", "opening_balance", "balance"],
      rows.map((p) => [p.name, p.phone, p.address, p.type, p.category, p.opening_balance, p.balance.toFixed(2)])
    );
  }
  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const csv = await file.text();
    const { ok, data } = await api("/api/parties", { op: "import", csv });
    if (ok) { alert(`Imported ${data.count} parties`); router.refresh(); }
    else alert((data.error as string) || "Import failed");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div>
      <PageHeader title={t("parties")} count={parties.length}>
        <button className="btn" onClick={exportCsv}>⬇ {t("export_csv")}</button>
        <button className="btn" onClick={() => fileRef.current?.click()}>⬆ {t("import_csv")}</button>
        <input ref={fileRef} type="file" accept=".csv" hidden onChange={onImport} />
        <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>+ {t("add")} {t("parties")}</button>
      </PageHeader>

      <div className="card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", marginBottom: ".75rem" }}>
          <input className="input" placeholder={`${t("search")}…`} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 280 }} />
          <select className="input" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} style={{ maxWidth: 180 }}>
            <option value="all">{t("all")}</option>
            <option value="receivable">{t("to_receive")}</option>
            <option value="payable">{t("to_give")}</option>
            <option value="customer">{t("customer")}</option>
            <option value="supplier">{t("supplier")}</option>
          </select>
        </div>
        <div style={{ overflowX: "auto" }} className="scroll-thin">
          <table className="tbl">
            <thead><tr>
              <th>{t("name")}</th><th>{t("phone")}</th><th>{t("type")}</th>
              <th style={{ textAlign: "right" }}>{t("balance")}</th><th></th>
            </tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/parties/${p.id}`} className="link">{p.name}</Link></td>
                  <td className="text-muted">{p.phone || "—"}</td>
                  <td><span className="pill pill-muted">{p.type}</span></td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>
                    {p.balance === 0 ? <span className="text-muted">{t("settled")}</span> :
                      <span style={{ color: p.balance > 0 ? "var(--brand)" : "var(--red)" }}>
                        {money(p.balance, symbol)} <span style={{ fontSize: ".7rem" }}>{p.balance > 0 ? t("to_receive") : t("to_give")}</span>
                      </span>}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn" style={{ padding: ".25rem .5rem" }} onClick={() => { setEditing(p); setShowForm(true); }}>✎</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="text-muted" style={{ textAlign: "center", padding: "2rem" }}>{t("no_data")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && <PartyForm party={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); router.refresh(); }} />}
    </div>
  );
}

function PartyForm({ party, onClose, onSaved }: { party: Party | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useT();
  const [f, setF] = useState({
    name: party?.name || "", phone: party?.phone || "", address: party?.address || "",
    type: party?.type || "customer", category: party?.category || "",
    opening_balance: party?.opening_balance ?? 0, note: party?.note || "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function save() {
    if (!f.name.trim()) return;
    setBusy(true);
    const { ok, data } = await api("/api/parties", party ? { op: "update", id: party.id, ...f } : { op: "create", ...f });
    setBusy(false);
    if (ok) onSaved(); else alert((data.error as string) || "Failed");
  }
  async function del() {
    if (!party || !confirm("Delete this party?")) return;
    const { ok } = await api("/api/parties", { op: "delete", id: party.id });
    if (ok) onSaved();
  }

  return (
    <Modal title={party ? `${t("edit")} ${t("parties")}` : `${t("add")} ${t("parties")}`} onClose={onClose}>
      <div style={{ display: "grid", gap: ".6rem" }}>
        <div><label className="label">{t("name")} *</label><input className="input" value={f.name} onChange={set("name")} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".6rem" }}>
          <div><label className="label">{t("phone")}</label><input className="input" value={f.phone} onChange={set("phone")} /></div>
          <div><label className="label">{t("type")}</label>
            <select className="input" value={f.type} onChange={set("type")}>
              <option value="customer">{t("customer")}</option>
              <option value="supplier">{t("supplier")}</option>
              <option value="both">Both</option>
            </select>
          </div>
        </div>
        <div><label className="label">{t("address")}</label><input className="input" value={f.address} onChange={set("address")} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".6rem" }}>
          <div><label className="label">{t("category")}</label><input className="input" value={f.category} onChange={set("category")} /></div>
          <div><label className="label">Opening Balance (+receivable)</label><input className="input" type="number" value={f.opening_balance} onChange={set("opening_balance")} /></div>
        </div>
        <div><label className="label">{t("note")}</label><textarea className="input" value={f.note} onChange={set("note")} rows={2} /></div>
        <div style={{ display: "flex", gap: ".5rem", marginTop: ".5rem" }}>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{t("save")}</button>
          <button className="btn" onClick={onClose}>{t("cancel")}</button>
          {party && <button className="btn btn-danger" style={{ marginLeft: "auto" }} onClick={del}>{t("delete")}</button>}
        </div>
      </div>
    </Modal>
  );
}
