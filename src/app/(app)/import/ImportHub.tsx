"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, downloadCsv } from "@/lib/clientUtil";

export default function ImportHub({ canRestore }: { canRestore: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const partyRef = useRef<HTMLInputElement>(null);
  const itemRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  async function importCsv(kind: "parties" | "items", file?: File) {
    if (!file) return;
    const csv = await file.text();
    const { ok, data } = await api(`/api/${kind}`, { op: "import", csv });
    setMsg(ok ? `✅ Imported ${data.count} ${kind}.` : `❌ ${(data.error as string) || "Import failed"}`);
    if (ok) router.refresh();
  }
  async function restoreJson(file?: File) {
    if (!file) return;
    if (!confirm("Restoring REPLACES all data in this business. Continue?")) return;
    try {
      const payload = JSON.parse(await file.text());
      const res = await fetch("/api/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ payload }) });
      const data = await res.json();
      setMsg(res.ok ? "✅ Business restored from JSON." : `❌ ${data.error || "Restore failed"}`);
      if (res.ok) router.refresh();
    } catch { setMsg("❌ Invalid JSON file."); }
  }

  const sampleParties = () => downloadCsv("parties-template.csv", ["name", "phone", "address", "type", "category", "opening_balance"], [["Example Customer", "01700000000", "Dhaka", "customer", "Retail", "0"]]);
  const sampleItems = () => downloadCsv("items-template.csv", ["name", "category", "type", "code", "sales_price", "purchase_price", "mrp_price", "wholesale_price", "min_wholesale_qty", "unit", "opening_stock", "low_stock_alert"], [["Example Item", "General", "Product", "1001", "200", "150", "220", "180", "5", "pcs", "10", "3"]]);

  const Card = ({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) => (
    <div className="card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: ".6rem" }}>
      <h2 style={{ fontWeight: 700 }}>{title}</h2>
      <p className="text-muted" style={{ fontSize: ".85rem", lineHeight: 1.5 }}>{desc}</p>
      <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", marginTop: "auto" }}>{children}</div>
    </div>
  );

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1rem" }}>Import Data</h1>
      {msg && <div className="card" style={{ padding: ".75rem 1rem", marginBottom: "1rem" }}>{msg}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: "1rem" }}>
        <Card title="Import Parties (CSV)" desc="Bulk-add customers & suppliers from a spreadsheet. Download the template, fill it, and upload.">
          <button className="btn" onClick={sampleParties}>⬇ Template</button>
          <button className="btn btn-primary" onClick={() => partyRef.current?.click()}>⬆ Upload CSV</button>
          <input ref={partyRef} type="file" accept=".csv" hidden onChange={(e) => importCsv("parties", e.target.files?.[0])} />
        </Card>
        <Card title="Import Items (CSV)" desc="Bulk-add products & services with prices and opening stock.">
          <button className="btn" onClick={sampleItems}>⬇ Template</button>
          <button className="btn btn-primary" onClick={() => itemRef.current?.click()}>⬆ Upload CSV</button>
          <input ref={itemRef} type="file" accept=".csv" hidden onChange={(e) => importCsv("items", e.target.files?.[0])} />
        </Card>
        <Card title="Restore full business (JSON)" desc="Load a complete Hishab backup — parties, items, invoices, payments, everything. Replaces current data.">
          {canRestore ? <button className="btn btn-primary" onClick={() => jsonRef.current?.click()}>⬆ Restore JSON</button> : <span className="text-muted" style={{ fontSize: ".8rem" }}>Owner/Admin only.</span>}
          <input ref={jsonRef} type="file" accept=".json" hidden onChange={(e) => restoreJson(e.target.files?.[0])} />
          <Link href="/backup" className="btn">Backup &amp; Restore →</Link>
        </Card>
      </div>
      <p className="text-muted" style={{ fontSize: ".82rem", marginTop: "1.25rem", lineHeight: 1.6 }}>
        Migrating from another app (e.g. Karbar)? Export your parties and items there as CSV and upload them here.
        For a full transfer of invoices and balances, use a Hishab JSON backup.
      </p>
    </div>
  );
}
