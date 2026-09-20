"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/Providers";
import { Modal, PageHeader } from "@/components/Modal";
import { api } from "@/lib/clientUtil";

type Member = { user_id: string; role: string; status: string; joined_at: string; name: string; email: string };
const ROLES = ["Admin", "Partner", "Staff"];

export default function StaffClient({ members, canManage, ownerId }: { members: Member[]; canManage: boolean; ownerId: string }) {
  const { t } = useT();
  const router = useRouter();
  const [show, setShow] = useState(false);

  async function changeRole(user_id: string, role: string) {
    await api("/api/staff", { op: "role", user_id, role });
    router.refresh();
  }
  async function remove(user_id: string) {
    if (!confirm("Remove this member?")) return;
    const { ok, data } = await api("/api/staff", { op: "remove", user_id });
    if (ok) router.refresh(); else alert((data.error as string) || "Failed");
  }

  return (
    <div>
      <PageHeader title={t("manage_staffs")} count={members.length}>
        {canManage && <button className="btn btn-primary" onClick={() => setShow(true)}>+ Add Staff</button>}
      </PageHeader>
      <div className="card" style={{ padding: "1.1rem", marginBottom: ".75rem" }}>
        <b>Multi Users</b>
        <p className="text-muted" style={{ fontSize: ".85rem", marginTop: ".25rem" }}>Add staff to run the business together, each with their own role and permissions.</p>
      </div>
      <div className="card" style={{ padding: "1rem", overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>{t("name")}</th><th>{t("email")}</th><th>{t("role")}</th><th>{t("status")}</th><th></th></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.user_id}>
                <td>{m.name}</td>
                <td className="text-muted">{m.email}</td>
                <td>
                  {m.user_id === ownerId ? <span className="pill pill-green">Owner</span> :
                    canManage ? (
                      <select className="input" style={{ width: 130, padding: ".3rem" }} value={m.role} onChange={(e) => changeRole(m.user_id, e.target.value)}>
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : <span className="pill pill-muted">{m.role}</span>}
                </td>
                <td><span className="pill pill-green">{m.status}</span></td>
                <td style={{ textAlign: "right" }}>
                  {canManage && m.user_id !== ownerId && <button className="btn btn-danger" style={{ padding: ".2rem .45rem" }} onClick={() => remove(m.user_id)}>✕</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {show && <InviteForm onClose={() => setShow(false)} onSaved={() => { setShow(false); router.refresh(); }} />}
    </div>
  );
}

function InviteForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Staff");
  async function save() {
    const { ok, data } = await api("/api/staff", { op: "invite", email, role });
    if (ok) onSaved(); else alert((data.error as string) || "Failed");
  }
  return (
    <Modal title="Add Staff" onClose={onClose}>
      <div style={{ display: "grid", gap: ".6rem" }}>
        <p className="text-muted" style={{ fontSize: ".82rem" }}>The person must already have a Hishab account. Enter their email to add them to this business.</p>
        <div><label className="label">{t("email")}</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><label className="label">{t("role")}</label><select className="input" value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
        <div style={{ display: "flex", gap: ".5rem", marginTop: ".4rem" }}><button className="btn btn-primary" onClick={save}>{t("save")}</button><button className="btn" onClick={onClose}>{t("cancel")}</button></div>
      </div>
    </Modal>
  );
}
