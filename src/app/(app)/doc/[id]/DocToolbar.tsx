"use client";
import { useRouter } from "next/navigation";
import { api } from "@/lib/clientUtil";

export default function DocToolbar({ id, kind }: { id: string; kind: string }) {
  const router = useRouter();
  const backHref = kind.startsWith("purchase") ? "/purchase" : "/sales-invoices";
  async function del() {
    if (!confirm("Delete this document? This also reverses its stock and balance effects.")) return;
    const { ok } = await api("/api/documents", { op: "delete", id });
    if (ok) router.push(backHref);
  }
  return (
    <div className="no-print" style={{ display: "flex", gap: ".4rem", marginBottom: "1rem", maxWidth: 760, margin: "0 auto 1rem" }}>
      <button className="btn" onClick={() => router.push(backHref)}>← Back</button>
      <button className="btn btn-primary" onClick={() => window.print()}>🖨 Print / PDF</button>
      <button className="btn btn-danger" style={{ marginLeft: "auto" }} onClick={del}>Delete</button>
    </div>
  );
}
