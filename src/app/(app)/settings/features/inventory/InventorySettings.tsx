"use client";
import { useState } from "react";
import type { BizSettings } from "@/lib/settings";
import { Icon } from "@/components/ui";
import { PageTitle, Row, Section, ToggleRow, useSettings } from "../../SettingsKit";

export default function InventorySettings({ initial }: { initial: BizSettings; business: unknown }) {
  const { s, save, toastNode } = useSettings(initial);
  const [unit, setUnit] = useState(s.default_unit);
  return (
    <div>
      <PageTitle>Inventory Settings</PageTitle>
      <Section title="Barcode & Images">
        <ToggleRow title="Enable Barcode Scan" desc="Use barcodes to find and record items quickly (POS & invoices)." on={s.barcode_scan} onChange={(v) => save({ barcode_scan: v })} />
        <ToggleRow title="Upload Item Image" desc="Show item photos in the item list and POS." on={s.item_image} onChange={(v) => save({ item_image: v })} />
      </Section>
      <Section title="Pricing & Inventory Management">
        <ToggleRow title="Wholesale Price" on={s.wholesale_price} onChange={(v) => save({ wholesale_price: v })} />
        <ToggleRow title="MRP" on={s.mrp} onChange={(v) => save({ mrp: v })} />
        <ToggleRow title="Item Location" desc="Record where an item is kept (rack, shelf, godown)." on={s.item_location} onChange={(v) => save({ item_location: v })} />
        <ToggleRow title="Low Stock Warning Dialog" desc="Warn when selling an item at or below its low-stock level." on={s.low_stock_dialog} onChange={(v) => save({ low_stock_dialog: v })} />
        <ToggleRow title="Prevent Out of Stock Sale" desc="Block selling more than the available quantity." on={s.prevent_out_of_stock} onChange={(v) => save({ prevent_out_of_stock: v })} />
      </Section>
      <Section title="Units & Quantity">
        <Row title="Default Unit" desc="Used for new items.">
          <input className="input" style={{ width: 110 }} value={unit} onChange={(e) => setUnit(e.target.value)} onBlur={() => unit !== s.default_unit && save({ default_unit: unit || "pcs" })} />
        </Row>
        <Row title="Quantity (up to decimal places)">
          <button className="btn btn-icon btn-sm" onClick={() => save({ qty_decimals: Math.max(0, s.qty_decimals - 1) })}><Icon name="minus" size={14} /></button>
          <b style={{ width: 22, textAlign: "center" }}>{s.qty_decimals}</b>
          <button className="btn btn-icon btn-sm" onClick={() => save({ qty_decimals: Math.min(4, s.qty_decimals + 1) })}><Icon name="plus" size={14} /></button>
        </Row>
      </Section>
      {toastNode}
    </div>
  );
}
