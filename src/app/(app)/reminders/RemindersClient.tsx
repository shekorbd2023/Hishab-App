"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/Providers";
import { Modal, PageHeader } from "@/components/Modal";
import { api } from "@/lib/clientUtil";

type Rem = { id: string; due_date: string; note: string | null; done: number; pname: string | null; party_id: string | null };
type Ref = { id: string; name: string };

export default function RemindersClient({ reminders, parties }: { reminders: Rem[]; parties: Ref[] }) {
  const { t } = useT();
  const router = useRouter();
  const [show, setShow] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  async function toggle(r: Rem) { await api("/api/reminders", { op: "done", id: r.id, done: r.done ? 0 : 1 }); router.refresh(); }
  async function del(id: string) { if (!confirm("Delete reminder?")) return; await api("/api/reminders", { op: "delete", id }); router.refresh(); }

  return (
    <div>
      <PageHeader title={t("reminders")} count={reminders.length}>
        <button className="btn btn-primary" onClick={() => setShow(true)}>+ {t("add")}</button>
      </PageHeader>
      <div className="card" style={{ padding: "1rem", overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th></th><th>Party</th><th>{t("date")}</th><th>{t("note")}</th><th></th></tr></thead>
          <tbody>
            {reminders.map((r) => {
              const overdue = !r.done && r.due_date < today;
              return (
                <tr key={r.id} style={{ opacity: r.done ? 0.55 : 1 }}>
                  <td><input type="checkbox" checked={!!r.done} onChange={() => toggle(r)} /></td>
                  <td style={{ textDecoration: r.done ? "line-through" : "none" }}>{r.pname || "—"}</td>
                  <td style={{ color: overdue ? "var(--red)" : "inherit" }}>{r.due_date}{overdue ? " ⚠" : ""}</td>
                  <td className="text-muted">{r.note || "—"}</td>
                  <td style={{ textAlign: "right" }}><button className="btn btn-danger" style={{ padding: ".2rem .45rem" }} onClick={() => del(r.id)}>✕</button></td>
                </tr>
              );
            })}
            {reminders.length === 0 && <tr><td colSpan={5} className="text-muted" style={{ textAlign: "center", padding: "2rem" }}>{t("no_data")}</td></tr>}
          </tbody>
        </table>
      </div>
      {show && <AddForm parties={parties} onClose={() => setShow(false)} onSaved={() => { setShow(false); router.refresh(); }} />}
    </div>
  );
}

function AddForm({ parties, onClose, onSaved }: { parties: Ref[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useT();
  const [f, setF] = useState({ party_id: "", due_date: new Date().toISOString().slice(0, 10), note: "" });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  async function save() {
    const { ok, data } = await api("/api/reminders", { op: "create", ...f });
    if (ok) onSaved(); else alert((data.error as string) || "Failed");
  }
  return (
    <Modal title={`${t("add")} ${t("reminders")}`} onClose={onClose}>
      <div style={{ display: "grid", gap: ".6rem" }}>
        <div><label className="label">Party (optional)</label>
          <select className="input" value={f.party_id} onChange={set("party_id")}>
            <option value="">— none —</option>
            {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div><label className="label">Due {t("date")}</label><input className="input" type="date" value={f.due_date} onChange={set("due_date")} /></div>
        <div><label className="label">{t("note")}</label><input className="input" value={f.note} onChange={set("note")} placeholder="e.g. collect due payment" /></div>
        <div style={{ display: "flex", gap: ".5rem", marginTop: ".3rem" }}><button className="btn btn-primary" onClick={save}>{t("save")}</button><button className="btn" onClick={onClose}>{t("cancel")}</button></div>
      </div>
    </Modal>
  );
}
