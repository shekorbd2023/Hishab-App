import { get, run } from "./db";

export type BizSettings = {
  invoice_footer: string;
  default_tax: number;
  show_logo: boolean;
};

const DEFAULTS: BizSettings = { invoice_footer: "Thank you for your business!", default_tax: 0, show_logo: true };

export function getSettings(businessId: string): BizSettings {
  const row = get<{ json: string | null }>("SELECT json FROM settings WHERE business_id = ?", [businessId]);
  if (!row?.json) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...(JSON.parse(row.json) as Partial<BizSettings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(businessId: string, s: Partial<BizSettings>) {
  const merged = { ...getSettings(businessId), ...s };
  const exists = get("SELECT business_id FROM settings WHERE business_id = ?", [businessId]);
  if (exists) run("UPDATE settings SET json = ? WHERE business_id = ?", [JSON.stringify(merged), businessId]);
  else run("INSERT INTO settings (business_id, json) VALUES (?,?)", [businessId, JSON.stringify(merged)]);
}
