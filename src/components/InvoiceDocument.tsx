// Printable sales / purchase / return / quotation document (Karbar "Preview Invoice" layout).
// Pure presentational component: no hooks, no DB — renders on the server or the client.
// Data is loaded by `src/app/(app)/doc/load.ts` (loadInvoice / loadLetterhead).
import React from "react";
import type { BizSettings } from "@/lib/settings";
import { fmtDate, tk, qty as fmtQty, amountInWords } from "@/lib/format";

export type Letterhead = {
  name: string;
  logo: string | null;
  showLogo: boolean;
  phone: string | null;
  email: string | null;
  address: string | null;
  regNo: string | null;
  bank: string | null; // multi-line bank details (when show_bank_account)
  bankQr: string | null; // data URL (when show_bank_qr)
  signature: string | null;
  terms: string;
  color: string;
  hideBranding: boolean;
};

export type InvoiceLine = {
  name: string; qty: number; rate: number; unit: string | null;
  discount: number; discountPct: number; taxRate: number; amount: number;
};

export type InvoiceData = {
  kind: string; // sales_invoice | purchase_bill | quotation | sales_return | purchase_return
  number: string;
  date: string;
  time?: string | null; // created_at ISO (thermal)
  dueDate: string | null;
  paymentMode: string | null;
  party: { name: string; phone: string | null; address: string | null; email?: string | null; vat?: string | null } | null;
  lines: InvoiceLine[];
  subTotal: number;
  taxTotal: number;
  charges: { title: string; amount: number }[];
  docDiscount: number;
  roundOff: number;
  total: number;
  received: number;
  prevBalance: number | null;
  currentBalance: number | null;
  notes: string | null;
  status?: string;
};

type PrintSettings = Pick<BizSettings, "invoice_style" | "page_size" | "thermal_width" | "show_item_unit" | "show_notes" | "show_party_balance">;

export const DOC_TITLE: Record<string, string> = {
  sales_invoice: "Sales Details", purchase_bill: "Purchase Details", sales_return: "Sales Return",
  purchase_return: "Purchase Return", quotation: "Quotation",
};
export const DOC_NAME: Record<string, string> = {
  sales_invoice: "Sales Invoice", purchase_bill: "Purchase Bill", sales_return: "Sales Return",
  purchase_return: "Purchase Return", quotation: "Quotation",
};
const NO_LABEL: Record<string, string> = {
  sales_invoice: "Invoice No", purchase_bill: "Bill No", sales_return: "Return No", purchase_return: "Return No", quotation: "Quotation No",
};
const DATE_LABEL: Record<string, string> = {
  sales_invoice: "Invoice Date", purchase_bill: "Bill Date", sales_return: "Return Date", purchase_return: "Return Date", quotation: "Quotation Date",
};
/** Money that came in (sales, purchase return) is "Received"; money that went out is "Paid". */
export const receivedLabel = (kind: string) => (kind === "sales_invoice" || kind === "purchase_return" ? "Received Amount" : "Paid Amount");

function balanceText(v: number) {
  if (Math.abs(v) < 0.005) return tk(0);
  return `${tk(Math.abs(v))} ${v > 0 ? "(To Receive)" : "(To Give)"}`;
}

/** Dhaka-local "21 Sep 2026, 11:45 PM" from an ISO timestamp. */
export function fmtDateTime(date: string, iso?: string | null): string {
  if (!iso) return fmtDate(date);
  const t = new Date(new Date(iso).getTime() + 6 * 3600 * 1000);
  if (isNaN(t.getTime())) return fmtDate(date);
  let h = t.getUTCHours();
  const m = String(t.getUTCMinutes()).padStart(2, "0");
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${fmtDate(date)}, ${h}:${m} ${ap}`;
}

/* ------------------------------------------------------------------ letterhead */
export function Letterhead({ lh, compact }: { lh: Letterhead; compact?: boolean }) {
  const contact = [lh.phone, lh.email, lh.address].filter(Boolean) as string[];
  return (
    <div className="inv-head">
      <div className="inv-biz">
        {lh.showLogo && (lh.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="inv-logo" src={lh.logo} alt="" />
        ) : (
          <span className="inv-logo inv-logo-ph">{(Array.from(lh.name.trim())[0] || "?").toUpperCase()}</span>
        ))}
        <div style={{ minWidth: 0 }}>
          <div className="inv-name">{lh.name}</div>
          {contact.length > 0 && <div className="inv-contact">{contact.join("  ·  ")}</div>}
          {lh.regNo && <div className="inv-contact">Reg. No: {lh.regNo}</div>}
        </div>
      </div>
      {!lh.hideBranding && (
        <div className="inv-brand" aria-label="Hishab">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" width={compact ? 20 : 26} height={compact ? 20 : 26} />
          <span>Hishab</span>
        </div>
      )}
    </div>
  );
}

export function SignatureBlock({ lh }: { lh: Letterhead }) {
  if (!lh.signature) return null;
  return (
    <div className="inv-sign">
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={lh.signature} alt="Signature" />
        <div className="inv-sign-line">Authorized Signature</div>
      </div>
    </div>
  );
}

export function PaperFooter({ lh }: { lh: Letterhead }) {
  if (lh.hideBranding) return null;
  return <div className="inv-foot">Generated with Hishab · হিসাব</div>;
}

/* ------------------------------------------------------------------ A4 / A5 invoice */
export default function InvoiceDocument({ data, lh, settings }: { data: InvoiceData; lh: Letterhead; settings: PrintSettings }) {
  const compact = settings.invoice_style === "compact";
  const isQuote = data.kind === "quotation";
  const due = Math.max(0, Math.round((data.total - data.received) * 100) / 100);
  const anyDiscount = data.lines.some((l) => l.discount > 0);
  const anyTax = data.lines.some((l) => l.taxRate > 0);
  const size = settings.page_size === "A5" ? "a5" : "a4";

  return (
    <article className={`pv-paper ${size} inv ${compact ? "compact" : "standard"}`} style={{ ["--inv" as string]: lh.color }}>
      <Letterhead lh={lh} compact={compact} />

      {compact ? (
        <div className="inv-title-compact"><span>{DOC_TITLE[data.kind] || "Invoice"}</span></div>
      ) : (
        <h1 className="inv-title">{DOC_TITLE[data.kind] || "Invoice"}</h1>
      )}

      <div className="inv-info">
        <div className="inv-party">
          <div className="inv-k">{data.kind.startsWith("purchase") ? "Supplier:" : "Party:"}</div>
          <div className="inv-party-name">{data.party?.name || (data.kind.startsWith("purchase") ? "Cash Purchase" : "Cash Sale")}</div>
          {data.party?.phone && <div className="inv-muted">{data.party.phone}</div>}
          {data.party?.address && <div className="inv-muted">{data.party.address}</div>}
          {data.party?.vat && <div className="inv-muted">VAT: {data.party.vat}</div>}
        </div>
        <dl className="inv-meta">
          <dt>{NO_LABEL[data.kind] || "No"}</dt><dd>{data.number}</dd>
          <dt>{DATE_LABEL[data.kind] || "Date"}</dt><dd>{fmtDate(data.date)}</dd>
          {!isQuote && data.paymentMode && (<><dt>Payment Mode</dt><dd>{data.paymentMode}</dd></>)}
          {data.dueDate && (<><dt>{isQuote ? "Valid Until" : "Due Date"}</dt><dd>{fmtDate(data.dueDate)}</dd></>)}
        </dl>
      </div>

      <table className="inv-table">
        <colgroup>
          <col style={{ width: "6%" }} />
          <col />
          <col style={{ width: "11%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: anyDiscount ? "16%" : "11%" }} />
          {anyTax && <col style={{ width: "8%" }} />}
          <col style={{ width: "14%" }} />
        </colgroup>
        <thead>
          <tr>
            <th className="c">S.N.</th>
            <th>Name</th>
            <th className="r">Qty</th>
            <th className="r">Rate</th>
            <th className="r">Discount</th>
            {anyTax && <th className="r">Tax</th>}
            <th className="r">Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((l, i) => (
            <tr key={i}>
              <td className="c">{i + 1}</td>
              <td className="inv-item">{l.name}</td>
              <td className="r">{fmtQty(l.qty)}{settings.show_item_unit && l.unit ? ` ${l.unit}` : ""}</td>
              <td className="r">{tk(l.rate)}</td>
              <td className="r">{l.discount > 0 ? <>{tk(l.discount)} <span className="inv-muted">({fmtQty(l.discountPct)}%)</span></> : tk(0)}</td>
              {anyTax && <td className="r">{l.taxRate ? `${fmtQty(l.taxRate)}%` : "-"}</td>}
              <td className="r">{tk(l.amount)}</td>
            </tr>
          ))}
          {data.lines.length === 0 && (
            <tr><td colSpan={anyTax ? 7 : 6} className="c inv-muted">No items</td></tr>
          )}
        </tbody>
      </table>

      <div className="inv-bottom">
        <div className="inv-left">
          <div className="inv-block">
            <div className="inv-k">Amount in Words</div>
            <div className="inv-words">{amountInWords(data.total)}</div>
          </div>
          {settings.show_notes && data.notes && (
            <div className="inv-block">
              <div className="inv-k">Notes</div>
              <div className="inv-pre">{data.notes}</div>
            </div>
          )}
          {lh.terms && (
            <div className="inv-block">
              <div className="inv-k">Terms &amp; Conditions</div>
              <div className="inv-pre">{lh.terms}</div>
            </div>
          )}
          {(lh.bank || lh.bankQr) && (
            <div className="inv-block inv-bank">
              {lh.bank && (
                <div>
                  <div className="inv-k">Bank Details</div>
                  <div className="inv-pre">{lh.bank}</div>
                </div>
              )}
              {lh.bankQr && (
                <div className="inv-qr">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={lh.bankQr} alt="Bank QR" />
                  <div className="inv-muted">Scan to pay</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="inv-totals">
          <Row l="Sub Total" v={tk(data.subTotal)} />
          {data.charges.map((c, i) => <Row key={i} l={c.title} v={tk(c.amount)} />)}
          {data.docDiscount > 0 && <Row l="Discount" v={`- ${tk(data.docDiscount)}`} />}
          {Math.abs(data.roundOff) > 0.001 && <Row l="Round Off" v={`${data.roundOff > 0 ? "+" : "-"} ${tk(Math.abs(data.roundOff))}`} />}
          <Row l="Total Amount" v={tk(data.total)} total />
          {!isQuote && <Row l={receivedLabel(data.kind)} v={tk(data.received)} />}
          {!isQuote && due > 0.004 && <Row l="Due Amount" v={tk(due)} strong />}
          {settings.show_party_balance && data.prevBalance !== null && <Row l="Previous Balance" v={balanceText(data.prevBalance)} muted />}
          {settings.show_party_balance && data.currentBalance !== null && <Row l="Current Balance" v={balanceText(data.currentBalance)} muted />}
        </div>
      </div>

      <SignatureBlock lh={lh} />
      <PaperFooter lh={lh} />
    </article>
  );
}

function Row({ l, v, total, strong, muted }: { l: string; v: string; total?: boolean; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`inv-row${total ? " total" : ""}${strong ? " strong" : ""}${muted ? " muted" : ""}`}>
      <span>{l}</span><span>{v}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ thermal (58 / 80 mm) */
export function ThermalInvoice({ data, lh, settings }: { data: InvoiceData; lh: Letterhead; settings: PrintSettings }) {
  const isQuote = data.kind === "quotation";
  const due = Math.max(0, Math.round((data.total - data.received) * 100) / 100);
  const w = settings.thermal_width === 58 ? "w58" : "w80";
  return (
    <article className={`pv-paper thermal ${w}`}>
      <ThermalHead lh={lh} />
      <div className="th-sep" />
      <div className="th-title">{(DOC_NAME[data.kind] || "Invoice").toUpperCase()} #{data.number}</div>
      <div className="th-kv"><span>Date</span><span>{fmtDateTime(data.date, data.time)}</span></div>
      <div className="th-kv"><span>{data.kind.startsWith("purchase") ? "Supplier" : "Customer"}</span><span>{data.party?.name || (data.kind.startsWith("purchase") ? "Cash Purchase" : "Cash Sale")}</span></div>
      {data.party?.phone && <div className="th-kv"><span>Phone</span><span>{data.party.phone}</span></div>}
      {!isQuote && data.paymentMode && <div className="th-kv"><span>Payment</span><span>{data.paymentMode}</span></div>}
      <div className="th-sep" />
      <div className="th-kv th-bold"><span>Item</span><span>Amount</span></div>
      <div className="th-sep thin" />
      {data.lines.map((l, i) => (
        <div key={i} className="th-line">
          <div className="th-name">{i + 1}. {l.name}</div>
          <div className="th-kv">
            <span>{fmtQty(l.qty)}{settings.show_item_unit && l.unit ? ` ${l.unit}` : ""} x {tk(l.rate, "")}{l.discount > 0 ? ` - ${tk(l.discount, "")}` : ""}</span>
            <span>{tk(l.amount, "")}</span>
          </div>
        </div>
      ))}
      <div className="th-sep" />
      <div className="th-kv"><span>Sub Total</span><span>{tk(data.subTotal)}</span></div>
      {data.charges.map((c, i) => <div key={i} className="th-kv"><span>{c.title}</span><span>{tk(c.amount)}</span></div>)}
      {data.docDiscount > 0 && <div className="th-kv"><span>Discount</span><span>- {tk(data.docDiscount)}</span></div>}
      {Math.abs(data.roundOff) > 0.001 && <div className="th-kv"><span>Round Off</span><span>{tk(data.roundOff)}</span></div>}
      <div className="th-sep thin" />
      <div className="th-kv th-total"><span>TOTAL</span><span>{tk(data.total)}</span></div>
      {!isQuote && <div className="th-kv"><span>{receivedLabel(data.kind).replace(" Amount", "")}</span><span>{tk(data.received)}</span></div>}
      {!isQuote && due > 0.004 && <div className="th-kv th-bold"><span>Due</span><span>{tk(due)}</span></div>}
      {settings.show_party_balance && data.currentBalance !== null && (
        <div className="th-kv"><span>Balance</span><span>{balanceText(data.currentBalance)}</span></div>
      )}
      <div className="th-sep" />
      <div className="th-words">{amountInWords(data.total)}</div>
      {settings.show_notes && data.notes && <div className="th-note">Note: {data.notes}</div>}
      {lh.bankQr && (
        // eslint-disable-next-line @next/next/no-img-element
        <div className="th-center"><img className="th-qr" src={lh.bankQr} alt="Bank QR" /></div>
      )}
      <div className="th-center th-thanks">{lh.terms || "Thank you for your business!"}</div>
      {!lh.hideBranding && <div className="th-center th-powered">Powered by Hishab</div>}
    </article>
  );
}

export function ThermalHead({ lh }: { lh: Letterhead }) {
  return (
    <div className="th-center">
      {lh.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="th-logo" src={lh.logo} alt="" />
      )}
      <div className="th-biz">{lh.name}</div>
      {lh.phone && <div>{lh.phone}</div>}
      {lh.address && <div>{lh.address}</div>}
      {lh.email && <div>{lh.email}</div>}
    </div>
  );
}
