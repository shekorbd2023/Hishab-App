import { get, run } from "./db";

// All business-level preferences (mirrors Karbar's Settings → General / Feature Settings / Invoice Print).
export type BizSettings = {
  // --- legacy ---
  invoice_footer: string;
  default_tax: number;
  show_logo: boolean;

  // --- General ---
  theme: "light" | "dark" | "classic" | "system";
  currency_position: "start" | "end";
  date_format: "DD MMM YYYY" | "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  number_format: "intl" | "indian"; // 1,000,000 vs 10,00,000
  privacy_mode: boolean; // hide dashboard stats & purchase price

  // --- Transactions ---
  cash_sale_default: boolean;
  due_date_reminder: boolean;
  other_income_enabled: boolean;
  prefixes_enabled: boolean;
  prefix_sales: string;
  prefix_sales_return: string;
  prefix_payment_in: string;
  prefix_quotation: string;
  additional_charges_enabled: boolean;
  charge_presets: string[]; // e.g. ["Delivery charge", "Bkash cashout charge"]
  round_off_enabled: boolean;

  // --- Inventory ---
  barcode_scan: boolean;
  item_image: boolean;
  wholesale_price: boolean;
  mrp: boolean;
  item_location: boolean;
  low_stock_dialog: boolean;
  prevent_out_of_stock: boolean;
  default_unit: string;
  qty_decimals: number;

  // --- Parties ---
  party_category: boolean;
  party_image: boolean;

  // --- Invoice print ---
  print_type: "regular" | "thermal";
  invoice_style: "standard" | "compact";
  invoice_color: string; // hex
  page_size: "A4" | "A5";
  thermal_width: 58 | 80;
  signature: string | null; // data URL
  bank_qr: string | null; // data URL
  terms: string;
  show_bank_qr: boolean;
  show_business_logo: boolean;
  show_phone: boolean;
  show_address: boolean;
  show_email: boolean;
  show_bank_account: boolean;
  show_reg_no: boolean;
  show_party_balance: boolean;
  show_item_unit: boolean;
  show_notes: boolean;
  hide_branding: boolean;
  bank_account_text: string;
};

export const SETTINGS_DEFAULTS: BizSettings = {
  invoice_footer: "Thank you for doing business with us.",
  default_tax: 0,
  show_logo: true,

  theme: "light",
  currency_position: "start",
  date_format: "DD MMM YYYY",
  number_format: "intl",
  privacy_mode: false,

  cash_sale_default: true,
  due_date_reminder: false,
  other_income_enabled: true,
  prefixes_enabled: false,
  prefix_sales: "",
  prefix_sales_return: "",
  prefix_payment_in: "",
  prefix_quotation: "",
  additional_charges_enabled: true,
  charge_presets: ["Delivery charge", "Bkash cashout charge"],
  round_off_enabled: false,

  barcode_scan: true,
  item_image: false,
  wholesale_price: true,
  mrp: true,
  item_location: false,
  low_stock_dialog: true,
  prevent_out_of_stock: false,
  default_unit: "pcs",
  qty_decimals: 2,

  party_category: true,
  party_image: false,

  print_type: "regular",
  invoice_style: "standard",
  invoice_color: "#1f9d6f",
  page_size: "A4",
  thermal_width: 80,
  signature: null,
  bank_qr: null,
  terms: "Thank you for doing business with us.",
  show_bank_qr: false,
  show_business_logo: true,
  show_phone: true,
  show_address: true,
  show_email: true,
  show_bank_account: false,
  show_reg_no: false,
  show_party_balance: false,
  show_item_unit: true,
  show_notes: true,
  hide_branding: false,
  bank_account_text: "",
};

export const INVOICE_COLORS = [
  "#1f9d6f", "#e5484d", "#0b84ff", "#f76b15", "#0aa2c0", "#0f7a4a", "#c2298a", "#d4a100", "#6e56cf", "#16233b",
];

export function getSettings(businessId: string): BizSettings {
  const row = get<{ json: string | null }>("SELECT json FROM settings WHERE business_id = ?", [businessId]);
  if (!row?.json) return { ...SETTINGS_DEFAULTS };
  try {
    const parsed = JSON.parse(row.json) as Partial<BizSettings>;
    const s = { ...SETTINGS_DEFAULTS, ...parsed };
    // keep legacy flag in sync
    if (parsed.show_logo === false && parsed.show_business_logo === undefined) s.show_business_logo = false;
    return s;
  } catch {
    return { ...SETTINGS_DEFAULTS };
  }
}

export function saveSettings(businessId: string, s: Partial<BizSettings>) {
  const merged = { ...getSettings(businessId), ...s };
  const exists = get("SELECT business_id FROM settings WHERE business_id = ?", [businessId]);
  if (exists) run("UPDATE settings SET json = ? WHERE business_id = ?", [JSON.stringify(merged), businessId]);
  else run("INSERT INTO settings (business_id, json) VALUES (?,?)", [businessId, JSON.stringify(merged)]);
}
