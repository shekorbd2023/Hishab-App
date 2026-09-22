"use client";
import { useState } from "react";
import type { BizSettings } from "@/lib/settings";
import { Icon } from "@/components/ui";
import { PageTitle, Row, Section, ToggleRow, useSettings } from "../../SettingsKit";

export default function TransactionsSettings({ initial }: { initial: BizSettings; business: unknown }) {
  const { s, save, toastNode } = useSettings(initial);
  const [presets, setPresets] = useState<string[]>(s.charge_presets);
  const [newP, setNewP] = useState("");
  const [px, setPx] = useState({ prefix_sales: s.prefix_sales, prefix_sales_return: s.prefix_sales_return, prefix_payment_in: s.prefix_payment_in, prefix_quotation: s.prefix_quotation });
  function savePresets(list: string[]) { setPresets(list); save({ charge_presets: list }, "Charges updated"); }
  return (
    <div>
      <PageTitle>Transaction Settings</PageTitle>
      <Section title="Sales">
        <ToggleRow title="Set Cash Sale by Default" desc="New sales start as a Cash Sale with the full amount received." on={s.cash_sale_default} onChange={(v) => save({ cash_sale_default: v })} />
        <ToggleRow title="Enable Due Date Reminder" desc="Record the due collection date for unpaid invoices." on={s.due_date_reminder} onChange={(v) => save({ due_date_reminder: v })} />
        <ToggleRow title="Enable Other Income Transaction" on={s.other_income_enabled} onChange={(v) => save({ other_income_enabled: v })} />
      </Section>
      <Section title="Additional Charges" hint="Charges such as delivery or bKash cash-out fees, added below the Sub Total and printed on the invoice.">
        <ToggleRow title="Enable Additional Charges" on={s.additional_charges_enabled} onChange={(v) => save({ additional_charges_enabled: v })} />
        {s.additional_charges_enabled && (
          <div style={{ padding: ".75rem 1rem", display: "grid", gap: ".5rem" }}>
            {presets.map((p, i) => (
              <div key={i} className="row">
                <input className="input" value={p} onChange={(e) => setPresets(presets.map((x, j) => (j === i ? e.target.value : x)))} onBlur={() => savePresets(presets.filter(Boolean))} />
                <button className="btn btn-icon btn-danger" onClick={() => savePresets(presets.filter((_, j) => j !== i))} aria-label="Remove"><Icon name="trash" size={15} /></button>
              </div>
            ))}
            <div className="row">
              <input className="input" placeholder="e.g. Packaging charge" value={newP} onChange={(e) => setNewP(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newP.trim()) { savePresets([...presets, newP.trim()]); setNewP(""); } }} />
              <button className="btn" disabled={!newP.trim()} onClick={() => { savePresets([...presets, newP.trim()]); setNewP(""); }}><Icon name="plus" size={15} />Add</button>
            </div>
          </div>
        )}
        <ToggleRow title="Enable Round Off" desc="Round invoice totals to the nearest taka." on={s.round_off_enabled} onChange={(v) => save({ round_off_enabled: v })} />
      </Section>
      <Section title="Transaction Prefixes" hint="e.g. SHK- makes invoice numbers print as SHK-324.">
        <ToggleRow title="Enable Transaction Prefixes" on={s.prefixes_enabled} onChange={(v) => save({ prefixes_enabled: v })} />
        {s.prefixes_enabled && ([["prefix_sales", "Sales Prefix"], ["prefix_sales_return", "Sales Return Prefix"], ["prefix_payment_in", "Payment In Prefix"], ["prefix_quotation", "Quotation Prefix"]] as const).map(([k, l]) => (
          <Row key={k} title={l}>
            <input className="input" style={{ width: 140 }} value={px[k]} onChange={(e) => setPx({ ...px, [k]: e.target.value })} onBlur={() => save({ [k]: px[k] } as Partial<BizSettings>)} />
          </Row>
        ))}
      </Section>
      {toastNode}
    </div>
  );
}
