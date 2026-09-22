"use client";
import { useState } from "react";
import { code128SVG } from "@/lib/barcode";
import { download } from "@/lib/clientUtil";

export default function BarcodeGen() {
  const [text, setText] = useState("HISHAB-1001");
  const [copies, setCopies] = useState(1);
  const svg = code128SVG(text || " ", { height: 90, module: 2.2 });

  function printLabels() {
    const w = window.open("", "_blank");
    if (!w) { window.print(); return; }
    const one = `<div style="display:inline-block;text-align:center;margin:8px;padding:8px;border:1px solid #ddd;border-radius:6px">${svg}<div style="font-family:sans-serif;font-size:12px;letter-spacing:1px;margin-top:4px">${text}</div></div>`;
    w.document.write(`<body style="margin:16px">${Array(Math.max(1, copies)).fill(one).join("")}<script>window.onload=()=>{window.print();}</script></body>`);
    w.document.close();
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "1rem" }}>Barcode Generator</h1>
      <div className="card" style={{ padding: "1.25rem", display: "grid", gap: ".75rem" }}>
        <div><label className="label">Text or number (Code 128)</label><input className="input" value={text} onChange={(e) => setText(e.target.value)} /></div>
        <div style={{ maxWidth: 160 }}><label className="label">Copies to print</label><input className="input" type="number" min={1} value={copies} onChange={(e) => setCopies(Number(e.target.value))} /></div>
        <div style={{ background: "#fff", borderRadius: 10, padding: "1rem", textAlign: "center", border: "1px solid var(--border)" }}>
          <div dangerouslySetInnerHTML={{ __html: svg }} />
          <div style={{ fontFamily: "monospace", letterSpacing: 2, marginTop: 6, color: "#000" }}>{text}</div>
        </div>
        <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={printLabels}>🖨 Print</button>
          <button className="btn" onClick={() => download(`barcode-${(text || "code").replace(/[^a-z0-9]/gi, "_")}.svg`, svg, "image/svg+xml")}>⬇ Download SVG</button>
        </div>
        <p className="text-muted" style={{ fontSize: ".8rem" }}>Tip: to print price labels for your products with name &amp; price, use Inventory → Barcode labels.</p>
      </div>
    </div>
  );
}
