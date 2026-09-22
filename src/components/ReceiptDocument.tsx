// Money receipt for a Payment In ("Payment Receipt") / Payment Out ("Payment Voucher").
// Same letterhead as the invoice (Karbar "Payment In #4" preview). Pure — no hooks, no DB.
import React from "react";
import type { BizSettings } from "@/lib/settings";
import { fmtDate, tk, amountInWords } from "@/lib/format";
import { Letterhead as LetterheadBlock, SignatureBlock, PaperFooter, ThermalHead, fmtDateTime, DOC_NAME, type Letterhead } from "./InvoiceDocument";

export type ReceiptData = {
  kind: "in" | "out";
  number: string;
  date: string;
  time?: string | null;
  amount: number;
  mode: string | null;
  party: { name: string; phone: string | null; address: string | null } | null;
  note: string | null;
  against: { kind: string; number: string } | null; // linked invoice / bill
  prevBalance: number | null;
  currentBalance: number | null;
};

type PrintSettings = Pick<BizSettings, "invoice_style" | "page_size" | "thermal_width" | "show_party_balance" | "show_notes">;

function balanceText(v: number) {
  if (Math.abs(v) < 0.005) return tk(0);
  return `${tk(Math.abs(v))} ${v > 0 ? "(To Receive)" : "(To Give)"}`;
}

export default function ReceiptDocument({ data, lh, settings }: { data: ReceiptData; lh: Letterhead; settings: PrintSettings }) {
  const compact = settings.invoice_style === "compact";
  const isIn = data.kind === "in";
  const size = settings.page_size === "A5" ? "a5" : "a4";
  return (
    <article className={`pv-paper ${size} inv rcpt ${compact ? "compact" : "standard"}`} style={{ ["--inv" as string]: lh.color }}>
      <LetterheadBlock lh={lh} compact={compact} />
      {compact ? (
        <div className="inv-title-compact"><span>{isIn ? "Payment Receipt" : "Payment Voucher"}</span></div>
      ) : (
        <h1 className="inv-title">{isIn ? "Payment Receipt" : "Payment Voucher"}</h1>
      )}

      <div className="inv-info">
        <div className="inv-party">
          <div className="inv-k">{isIn ? "Received From:" : "Paid To:"}</div>
          <div className="inv-party-name">{data.party?.name || "--"}</div>
          {data.party?.phone && <div className="inv-muted">{data.party.phone}</div>}
          {data.party?.address && <div className="inv-muted">{data.party.address}</div>}
        </div>
        <dl className="inv-meta">
          <dt>Voucher No</dt><dd>{data.number}</dd>
          <dt>Date</dt><dd>{fmtDate(data.date)}</dd>
          <dt>Payment Mode</dt><dd>{data.mode || "Cash"}</dd>
          {data.against && (<><dt>Against</dt><dd>{DOC_NAME[data.against.kind] || "Invoice"} #{data.against.number}</dd></>)}
        </dl>
      </div>

      <div className="rcpt-rule" />

      <div className="inv-bottom rcpt-bottom">
        <div className="inv-left">
          <div className="inv-block">
            <div className="inv-k">Amount in Words</div>
            <div className="inv-words">{amountInWords(data.amount)}</div>
          </div>
          {data.note && (
            <div className="inv-block">
              <div className="inv-k">Remarks</div>
              <div className="inv-pre">{data.note}</div>
            </div>
          )}
        </div>
        <div className="inv-totals">
          <div className="inv-row total rcpt-amount"><span>{isIn ? "Received Amount" : "Paid Amount"}</span><span>{tk(data.amount)}</span></div>
          {settings.show_party_balance && data.prevBalance !== null && (
            <div className="inv-row muted"><span>Previous Balance</span><span>{balanceText(data.prevBalance)}</span></div>
          )}
          {settings.show_party_balance && data.currentBalance !== null && (
            <div className="inv-row muted"><span>Current Balance</span><span>{balanceText(data.currentBalance)}</span></div>
          )}
        </div>
      </div>

      <SignatureBlock lh={lh} />
      <PaperFooter lh={lh} />
    </article>
  );
}

export function ThermalReceipt({ data, lh, settings }: { data: ReceiptData; lh: Letterhead; settings: PrintSettings }) {
  const isIn = data.kind === "in";
  const w = settings.thermal_width === 58 ? "w58" : "w80";
  return (
    <article className={`pv-paper thermal ${w}`}>
      <ThermalHead lh={lh} />
      <div className="th-sep" />
      <div className="th-title">{isIn ? "PAYMENT RECEIPT" : "PAYMENT VOUCHER"} #{data.number}</div>
      <div className="th-kv"><span>Date</span><span>{fmtDateTime(data.date, data.time)}</span></div>
      <div className="th-kv"><span>{isIn ? "Received From" : "Paid To"}</span><span>{data.party?.name || "--"}</span></div>
      {data.party?.phone && <div className="th-kv"><span>Phone</span><span>{data.party.phone}</span></div>}
      <div className="th-kv"><span>Payment Mode</span><span>{data.mode || "Cash"}</span></div>
      {data.against && <div className="th-kv"><span>Against</span><span>{DOC_NAME[data.against.kind] || "Invoice"} #{data.against.number}</span></div>}
      <div className="th-sep" />
      <div className="th-kv th-total"><span>{isIn ? "RECEIVED" : "PAID"}</span><span>{tk(data.amount)}</span></div>
      {settings.show_party_balance && data.currentBalance !== null && (
        <div className="th-kv"><span>Balance</span><span>{balanceText(data.currentBalance)}</span></div>
      )}
      <div className="th-sep" />
      <div className="th-words">{amountInWords(data.amount)}</div>
      {data.note && <div className="th-note">Remarks: {data.note}</div>}
      <div className="th-center th-thanks">{lh.terms || "Thank you!"}</div>
      {!lh.hideBranding && <div className="th-center th-powered">Powered by Hishab</div>}
    </article>
  );
}
