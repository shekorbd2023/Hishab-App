"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import type { BizSettings } from "@/lib/settings";
import { INVOICE_COLORS } from "@/lib/invoice-colors";
import { Icon, Seg, shrinkImage } from "@/components/ui";
import { PageTitle, Row, Section, ToggleRow, useSettings } from "../../SettingsKit";

function ImageSetting({ title, desc, value, onChange }: { title: string; desc: string; value: string | null; onChange: (v: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <Row title={title} desc={desc}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {value && <img src={value} alt="" style={{ height: 40, maxWidth: 110, objectFit: "contain", border: "1px solid var(--border)", borderRadius: 6, background: "#fff" }} />}
      <button className="btn btn-sm" onClick={() => ref.current?.click()}><Icon name="upload" size={14} />{value ? "Change" : "Upload"}</button>
      {value && <button className="btn btn-sm btn-danger" onClick={() => onChange(null)}>Remove</button>}
      <input ref={ref} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onChange(await shrinkImage(f, 420, "image/png")); }} />
    </Row>
  );
}

export default function InvoicePrintSettings({ initial, business }: { initial: BizSettings; business: { name: string; logo: string | null; phone: string | null } }) {
  const { s, save, toastNode } = useSettings(initial);
  const [terms, setTerms] = useState(s.terms);
  const [bank, setBank] = useState(s.bank_account_text);
  const toggles: [keyof BizSettings, string][] = [
    ["show_business_logo", "Show Business Logo on Invoice"], ["show_phone", "Show Phone Number on Invoice"],
    ["show_address", "Show Address on Invoice"], ["show_email", "Show Email on Invoice"], ["show_bank_qr", "Show Bank QR on Invoice"],
    ["show_bank_account", "Show Bank Account on Invoice"], ["show_reg_no", "Show Registration No. on Invoice"],
    ["show_party_balance", "Show Party Balance on Invoice"], ["show_item_unit", "Show Item Unit on Invoice"],
    ["show_notes", "Show Notes on Invoice"], ["hide_branding", "Hide Hishab Branding"],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 230px", gap: "1.25rem", alignItems: "start" }}>
      <div>
        <PageTitle>Invoice Print Settings</PageTitle>
        <Section title="Print Type">
          <Row title="Select Default Print Type" desc="Regular = A4/A5 paper. Thermal = 58/80 mm POS receipt printer.">
            <Seg value={s.print_type} onChange={(v) => save({ print_type: v })} options={[{ v: "regular", l: "Regular" }, { v: "thermal", l: "Thermal" }]} />
          </Row>
          {s.print_type === "thermal" ? (
            <Row title="Thermal Paper Width"><Seg value={String(s.thermal_width)} onChange={(v) => save({ thermal_width: Number(v) as 58 | 80 })} options={[{ v: "80", l: "80 mm" }, { v: "58", l: "58 mm" }]} /></Row>
          ) : (
            <Row title="Page Size"><Seg value={s.page_size} onChange={(v) => save({ page_size: v })} options={[{ v: "A4", l: "A4 (210 × 297 mm)" }, { v: "A5", l: "A5 (148 × 210 mm)" }]} /></Row>
          )}
        </Section>
        <Section title="Invoice Style & Colour">
          <div style={{ padding: "1rem", display: "grid", gap: "1rem" }}>
            <div className="row" style={{ gap: ".75rem" }}>
              {(["standard", "compact"] as const).map((st) => (
                <button key={st} className={`style-card ${s.invoice_style === st ? "on" : ""}`} onClick={() => save({ invoice_style: st })}>
                  <div className="mini-inv">
                    <div className="ln" style={{ width: "50%" }} />
                    {st === "standard" ? <div className="ln" style={{ width: "30%", margin: "6px auto" }} /> : <div className="bar" style={{ width: "40%", background: s.invoice_color }} />}
                    <div className="bar" style={{ background: s.invoice_color }} />
                    <div className="ln" /><div className="ln" /><div className="ln" style={{ width: "60%", marginLeft: "40%" }} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 12, marginTop: 6 }}>{st === "standard" ? "Standard" : "Compact"}</div>
                </button>
              ))}
            </div>
            <div className="row" style={{ flexWrap: "wrap" }}>
              {INVOICE_COLORS.map((c) => (
                <button key={c} className={`swatch ${s.invoice_color === c ? "on" : ""}`} style={{ background: c }} onClick={() => save({ invoice_color: c })} aria-label={c}>
                  {s.invoice_color === c && <Icon name="check" size={14} />}
                </button>
              ))}
            </div>
          </div>
        </Section>
        <Section title="Invoice Content">
          <ImageSetting title="Signature" desc="Printed at the bottom right with “Authorized Signature”." value={s.signature} onChange={(v) => save({ signature: v })} />
          <ImageSetting title="Bank QR" desc="bKash / Nagad / bank QR code customers can scan to pay." value={s.bank_qr} onChange={(v) => save({ bank_qr: v })} />
          <div style={{ padding: ".85rem 1rem", borderBottom: "1px solid var(--border)", display: "grid", gap: ".35rem" }}>
            <div className="set-row-title">Bank Account Details</div>
            <textarea className="input" rows={2} placeholder="Dutch Bangla Bank, A/C 123…, Branch…" value={bank} onChange={(e) => setBank(e.target.value)} onBlur={() => bank !== s.bank_account_text && save({ bank_account_text: bank })} />
          </div>
          <div style={{ padding: ".85rem 1rem", display: "grid", gap: ".35rem" }}>
            <div className="set-row-title">Terms &amp; Conditions</div>
            <textarea className="input" rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} onBlur={() => terms !== s.terms && save({ terms, invoice_footer: terms })} />
          </div>
        </Section>
        <Section title="Invoice Customization">
          {toggles.map(([k, l]) => <ToggleRow key={k} title={l} on={Boolean(s[k])} onChange={(v) => save({ [k]: v } as Partial<BizSettings>)} />)}
        </Section>
      </div>

      <aside style={{ position: "sticky", top: 72 }}>
        <div className="set-sec-title" style={{ marginTop: "2.4rem" }}>Preview</div>
        <div className="card" style={{ padding: 12, background: "#fff", color: "#111" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {s.show_business_logo && business.logo && <img src={business.logo} alt="" style={{ width: 26, height: 26, borderRadius: 4, objectFit: "cover" }} />}
            <div style={{ fontWeight: 800, fontSize: 12 }}>{business.name}</div>
          </div>
          {s.show_phone && business.phone && <div style={{ fontSize: 9, color: "#555" }}>{business.phone}</div>}
          <div style={{ textAlign: "center", fontWeight: 800, fontSize: 11, margin: "8px 0" }}>Sales Details</div>
          <div style={{ background: s.invoice_color, height: 12, borderRadius: 2 }} />
          {[1, 2, 3].map((i) => <div key={i} style={{ height: 9, borderBottom: "1px solid #e5e7eb" }} />)}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, marginTop: 6 }}><span>Total Amount</span><b>Tk. 4,675</b></div>
          {s.signature && <div style={{ textAlign: "right", fontSize: 8, marginTop: 10, borderTop: "1px solid #999", width: 70, marginLeft: "auto" }}>Signature</div>}
        </div>
        <Link href="/sales-invoices" className="link" style={{ display: "block", marginTop: 8, fontSize: 12 }}>Open an invoice to see the full print →</Link>
      </aside>
      {toastNode}
    </div>
  );
}
