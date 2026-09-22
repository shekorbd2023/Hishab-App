"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, post, useToast } from "@/components/ui";
import { PageTitle, Section } from "../SettingsKit";

export default function AccountForm({ name, email, role }: { name: string; email: string; role: string }) {
  const router = useRouter();
  const { toast, node } = useToast();
  const [n, setN] = useState(name);
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  async function save() {
    if (pw && pw !== pw2) { toast("New passwords do not match"); return; }
    const { ok, data } = await post("/api/settings", { op: "account", name: n, current_password: cur, new_password: pw || undefined });
    if (!ok) { toast(data.error || "Could not save"); return; }
    setCur(""); setPw(""); setPw2(""); toast(pw ? "Profile and password updated" : "Profile updated"); router.refresh();
  }
  return (
    <div>
      <PageTitle>My Account</PageTitle>
      <Section title="Profile">
        <div style={{ padding: "1rem", display: "grid", gap: ".9rem" }}>
          <div className="row"><Avatar name={n} size="lg" /><div><div style={{ fontWeight: 700 }}>{n}</div><div className="sub">{email} · {role}</div></div></div>
          <div className="form-grid">
            <div className="field"><label className="label">Full Name</label><input className="input" value={n} onChange={(e) => setN(e.target.value)} /></div>
            <div className="field"><label className="label">Login Email</label><input className="input" value={email} disabled /></div>
          </div>
        </div>
      </Section>
      <Section title="Change Password">
        <div className="form-grid" style={{ padding: "1rem" }}>
          <div className="field"><label className="label">Current Password</label><input className="input" type="password" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
          <div />
          <div className="field"><label className="label">New Password</label><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
          <div className="field"><label className="label">Confirm New Password</label><input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
        </div>
      </Section>
      <div className="row" style={{ justifyContent: "flex-end" }}><button className="btn btn-primary btn-lg" onClick={save}>Save Changes</button></div>
      {node}
    </div>
  );
}
