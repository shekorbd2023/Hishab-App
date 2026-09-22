// Client-safe metadata + money math for the 5 transaction kinds (lists, editor, POS).

export type DocKind = "sales_invoice" | "purchase_bill" | "quotation" | "sales_return" | "purchase_return";
export const DOC_KINDS: DocKind[] = ["sales_invoice", "purchase_bill", "quotation", "sales_return", "purchase_return"];
export const isDocKind = (k: unknown): k is DocKind => typeof k === "string" && (DOC_KINDS as string[]).includes(k);

export type KindMeta = {
  plural: string; single: string; create: string; noLabel: string; path: string; search: string;
  noun: string; // "invoices", "bills"…
  convert?: { to: DocKind; label: string };
  payLabel: string; fullyLabel: string; // "Received Amount" / "Fully received"
  priceField: "sales_price" | "purchase_price";
  partyType: "customer" | "supplier";
  cashLabel: string; // "Cash Sale"
  stockSign: 1 | -1 | 0; // effect on stock
  prefixKey?: "prefix_sales" | "prefix_sales_return" | "prefix_quotation";
};

export const KIND: Record<DocKind, KindMeta> = {
  sales_invoice: {
    plural: "Sales Invoices", single: "Sales Invoice", create: "Create Sales Invoice", noLabel: "Invoice No", path: "/sales-invoices",
    search: "Search invoices…", noun: "invoices", convert: { to: "sales_return", label: "Convert to Sales Return" },
    payLabel: "Received Amount", fullyLabel: "Fully received", priceField: "sales_price", partyType: "customer", cashLabel: "Cash Sale",
    stockSign: -1, prefixKey: "prefix_sales",
  },
  purchase_bill: {
    plural: "Purchase Bills", single: "Purchase Bill", create: "Create Purchase Bill", noLabel: "Bill No", path: "/purchase",
    search: "Search bills…", noun: "bills", convert: { to: "purchase_return", label: "Convert to Purchase Return" },
    payLabel: "Paid Amount", fullyLabel: "Fully paid", priceField: "purchase_price", partyType: "supplier", cashLabel: "Cash Purchase",
    stockSign: 1,
  },
  quotation: {
    plural: "Quotations", single: "Quotation", create: "Create Quotation", noLabel: "Quotation No", path: "/quotations",
    search: "Search quotations…", noun: "quotations", convert: { to: "sales_invoice", label: "Convert to Sales Invoice" },
    payLabel: "", fullyLabel: "", priceField: "sales_price", partyType: "customer", cashLabel: "Cash Sale",
    stockSign: 0, prefixKey: "prefix_quotation",
  },
  sales_return: {
    plural: "Sales Return", single: "Sales Return", create: "Create Sales Return", noLabel: "Return No", path: "/sales-return",
    search: "Search returns…", noun: "returns",
    payLabel: "Paid Amount", fullyLabel: "Fully paid", priceField: "sales_price", partyType: "customer", cashLabel: "Cash Sale",
    stockSign: 1, prefixKey: "prefix_sales_return",
  },
  purchase_return: {
    plural: "Purchase Return", single: "Purchase Return", create: "Create Purchase Return", noLabel: "Return No", path: "/purchase-return",
    search: "Search returns…", noun: "returns",
    payLabel: "Received Amount", fullyLabel: "Fully received", priceField: "purchase_price", partyType: "supplier", cashLabel: "Cash Purchase",
    stockSign: -1,
  },
};

export type Line = {
  itemId?: string | null; name: string; qty: number; rate: number;
  discountType?: "flat" | "percent"; discountValue?: number; taxRate?: number; unit?: string | null;
};
export type Charge = { title: string; amount: number };

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function lineDisc(l: Line): number {
  const base = l.qty * l.rate;
  return l.discountType === "percent" ? (base * (l.discountValue || 0)) / 100 : l.discountValue || 0;
}
export function lineAmt(l: Line): number {
  const after = Math.max(0, l.qty * l.rate - lineDisc(l));
  return r2(after + (after * (l.taxRate || 0)) / 100);
}

/** Mirrors computeTotals() in src/lib/actions.ts so the screen shows exactly what the server will store. */
export function totals(lines: Line[], docDiscount = 0, charges: Charge[] = [], roundOff = 0) {
  let subtotal = 0, disc = 0, tax = 0;
  for (const l of lines) {
    const base = l.qty * l.rate;
    const d = lineDisc(l);
    const after = Math.max(0, base - d);
    subtotal += base; disc += d; tax += (after * (l.taxRate || 0)) / 100;
  }
  const billing = subtotal - disc + tax;
  const ch = charges.reduce((a, c) => a + (Number(c.amount) || 0), 0);
  const beforeRound = billing - (Number(docDiscount) || 0) + ch;
  return {
    subtotal: r2(subtotal), lineDiscount: r2(disc), tax: r2(tax), billing: r2(billing), charges: r2(ch),
    beforeRound: r2(beforeRound), total: r2(beforeRound + (Number(roundOff) || 0)),
  };
}

export const num = (s: string | number | null | undefined) => {
  const v = typeof s === "number" ? s : parseFloat(String(s ?? "").replace(/,/g, ""));
  return Number.isFinite(v) ? v : 0;
};
