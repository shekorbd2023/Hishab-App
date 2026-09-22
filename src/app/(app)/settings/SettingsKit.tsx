"use client";
// Shared pieces for every settings screen: auto-saving toggles/fields with a toast.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Switch, post, useToast } from "@/components/ui";
import type { BizSettings } from "@/lib/settings";

export function useSettings(initial: BizSettings) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const { toast, node } = useToast();
  async function save(patch: Partial<BizSettings>, msg = "Saved") {
    setS((o) => ({ ...o, ...patch }));
    const { ok, data } = await post("/api/settings", { op: "settings", patch });
    if (!ok) { toast(data.error || "Could not save"); return; }
    toast(msg); router.refresh();
  }
  return { s, setS, save, toast, toastNode: node };
}

export function Section({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section className="set-sec">
      <div className="set-sec-title">{title}</div>
      {hint && <div className="sub" style={{ margin: "-.2rem 0 .5rem" }}>{hint}</div>}
      <div className="card set-card">{children}</div>
    </section>
  );
}

export function Row({ title, desc, children }: { title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="set-row">
      <div style={{ minWidth: 0 }}>
        <div className="set-row-title">{title}</div>
        {desc && <div className="sub">{desc}</div>}
      </div>
      <div className="set-row-ctl">{children}</div>
    </div>
  );
}

export function ToggleRow({ title, desc, on, onChange }: { title: string; desc?: string; on: boolean; onChange: (v: boolean) => void }) {
  return <Row title={title} desc={desc}><Switch on={on} onChange={onChange} /></Row>;
}

export function PageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="page-title" style={{ marginBottom: "1rem" }}>{children}</h1>;
}
