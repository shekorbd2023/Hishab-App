"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/Providers";
import { api } from "@/lib/clientUtil";

export default function NewBusiness() {
  const { t } = useT();
  const router = useRouter();
  const [name, setName] = useState("");
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    const { ok, data } = await api("/api/business", { name, demo });
    setBusy(false);
    if (ok) { router.push("/dashboard"); router.refresh(); } else alert((data.error as string) || "Failed");
  }

  return (
    <div style={{ maxWidth: 440 }}>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "1rem" }}>{t("create_business")}</h1>
      <div className="card" style={{ padding: "1.5rem", display: "grid", gap: ".7rem" }}>
        <div><label className="label">{t("business_name")} *</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <label style={{ display: "flex", gap: ".5rem", alignItems: "center", fontSize: ".85rem" }}>
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} /> Load demo data
        </label>
        <div style={{ display: "flex", gap: ".5rem", marginTop: ".4rem" }}>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{t("save")}</button>
          <button className="btn" onClick={() => router.back()}>{t("cancel")}</button>
        </div>
      </div>
    </div>
  );
}
