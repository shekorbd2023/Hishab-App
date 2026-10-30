import { redirect, notFound } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import { all } from "@/lib/db";
import InvoiceDocument, { ThermalInvoice, DOC_NAME } from "@/components/InvoiceDocument";
import { PrintStage } from "@/components/PrintBar";
import { loadInvoice, paymentPickers } from "../load";
import DocBar from "./DocBar";
import Link from "next/link";
import { docProfits } from "@/lib/fifo";
import { tk, qty as fq } from "@/lib/format";

export const dynamic = "force-dynamic";

const LIST: Record<string, string> = {
  sales_invoice: "/sales-invoices", purchase_bill: "/purchase", quotation: "/quotations",
  sales_return: "/sales-return", purchase_return: "/purchase-return",
};

export default async function DocPreview({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const bid = ctx.business.id;
  const loaded = (await loadInvoice(bid, id));
  if (!loaded) notFound();
  const { data, settings, letterhead, partyId, partyPhone } = loaded;

  const thermal = sp.thermal === "1" || (settings.print_type === "thermal" && sp.regular !== "1");
  const pageCss = thermal
    ? `@page { size: ${settings.thermal_width === 58 ? 58 : 80}mm auto; margin: 0; }`
    : `@page { size: ${settings.page_size === "A5" ? "A5" : "A4"}; margin: 10mm; }`;
  const name = DOC_NAME[data.kind] || "Invoice";
  const fileName = `${name.replace(/ /g, "-")}-${data.number}${data.party ? "-" + data.party.name.replace(/[^\p{L}\p{N}]+/gu, "-") : ""}`;
  const { parties, accounts } = (await paymentPickers(bid));
  const next = (await all<{ kind: string; value: number }>("SELECT kind, value FROM counters WHERE business_id=?", [bid]));
  const nextOf = (k: string) => (next.find((c) => c.kind === k)?.value ?? 0) + 1;
  const due = Math.max(0, Math.round((data.total - data.received) * 100) / 100);
  const summary = `${ctx.business.name}\n${name} #${data.number} · ${data.date}\n` +
    data.lines.map((l) => `• ${l.name} × ${l.qty} = Tk. ${l.amount.toLocaleString("en-US")}`).join("\n") +
    (data.charges.length ? "\n" + data.charges.map((c) => `${c.title}: Tk. ${c.amount.toLocaleString("en-US")}`).join("\n") : "") +
    `\nTotal: Tk. ${data.total.toLocaleString("en-US")}` + (due > 0 ? `\nDue: Tk. ${due.toLocaleString("en-US")}` : "") + `\nThank you!`;

  const showProfit = (data.kind === "sales_invoice" || data.kind === "sales_return") && ["Owner", "Admin", "Partner"].includes(ctx.role) && !settings.privacy_mode;
  const profit = showProfit ? (await docProfits(bid, { docId: id }))[0] : undefined;
  const pct = (p: number, r: number) => (Math.abs(r) > 0.004 ? `${((p / r) * 100).toFixed(1)}%` : "--");

  return (
    <div>
      <DocBar
        id={id} kind={data.kind} title={`${name} #${data.number}`} backHref={LIST[data.kind] || "/sales-invoices"}
        fileName={fileName} thermal={thermal} partyId={partyId} partyPhone={partyPhone} due={due}
        parties={parties} accounts={accounts} nextIn={nextOf("payment_in")} nextOut={nextOf("payment_out")} summary={summary}
      />
      <PrintStage pageCss={pageCss}>
        {thermal ? <ThermalInvoice data={data} lh={letterhead} settings={settings} /> : <InvoiceDocument data={data} lh={letterhead} settings={settings} />}
      </PrintStage>
      {profit && (
        <div className="card no-print" style={{ maxWidth: 820, margin: "1rem auto", padding: "1rem" }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: ".6rem", flexWrap: "wrap", gap: ".5rem" }}>
            <div style={{ fontWeight: 700 }}>Profit on this {data.kind === "sales_return" ? "return" : "invoice"} (FIFO) · শুধু আপনি দেখছেন, প্রিন্টে আসবে না</div>
            <Link href="/reports/invoice-profit" className="btn">All invoices →</Link>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl" style={{ width: "100%", fontSize: ".9rem" }}>
              <thead><tr><th style={{ textAlign: "left" }}>Product</th><th style={{ textAlign: "right" }}>Qty</th><th style={{ textAlign: "right" }}>Sold for</th><th style={{ textAlign: "right" }}>Cost (FIFO)</th><th style={{ textAlign: "right" }}>Gross Profit</th><th style={{ textAlign: "right" }}>Margin</th></tr></thead>
              <tbody>
                {profit.lines.map((l) => (
                  <tr key={l.lineId}>
                    <td>{l.name}{l.cost === null && <div className="sub" style={{ fontSize: ".75rem" }}>Not linked to an inventory item — no cost</div>}{l.cost !== null && l.sources.length > 0 && (
                      <div className="sub" style={{ fontSize: ".75rem", marginTop: 2 }}>
                        {l.sources.map((src, i) => (
                          <div key={i}>
                            Cost from: {fq(src.qty)}{l.unit ? " " + l.unit : ""} × {tk(src.unitCost)} — {" "}
                            {src.kind === "opening" && <>Opening stock (item&apos;s Purchase Price) · ভুল হলে <Link href={`/inventory/${l.itemId}/edit`}>item-এ ঠিক করুন</Link></>}
                            {src.kind === "purchase" && <Link href={`/doc/${src.docId}`}>Purchase Bill #{src.docNumber} ({src.date})</Link>}
                            {src.kind === "later_purchase" && <>sold before stock was entered · covered by <Link href={`/doc/${src.docId}`}>Purchase Bill #{src.docNumber} ({src.date})</Link></>}
                            {src.kind === "sales_return" && <>returned stock (<Link href={`/doc/${src.docId}`}>Sales Return #{src.docNumber}</Link>)</>}
                            {src.kind === "adjustment" && <>stock added by adjustment ({src.date})</>}
                            {src.kind === "estimate" && <>no stock and no later purchase — estimated · <Link href={`/inventory/${l.itemId}`}>item দেখুন</Link></>}
                          </div>
                        ))}
                      </div>
                    )}</td>
                    <td style={{ textAlign: "right" }}>{fq(l.qty)}{l.unit ? " " + l.unit : ""}</td>
                    <td style={{ textAlign: "right" }}>{tk(l.revenue)}</td>
                    <td style={{ textAlign: "right" }}>{l.cost === null ? "--" : tk(l.cost)}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }} className={l.profit === null ? "" : l.profit >= 0 ? "pos" : "neg"}>{l.profit === null ? "--" : tk(l.profit)}</td>
                    <td style={{ textAlign: "right" }}>{l.profit === null ? "--" : pct(l.profit, l.revenue)}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                  <td>Total</td><td /><td style={{ textAlign: "right" }}>{tk(profit.revenue - profit.unlinked)}</td><td style={{ textAlign: "right" }}>{tk(profit.cost)}</td>
                  <td style={{ textAlign: "right" }} className={profit.profit >= 0 ? "pos" : "neg"}>{tk(profit.profit)}</td><td style={{ textAlign: "right" }}>{pct(profit.profit, profit.revenue - profit.unlinked)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="sub" style={{ fontSize: ".78rem", marginTop: ".5rem" }}>Sold for = after item and bill discounts, without tax. Delivery charge is not product profit.</div>
        </div>
      )}
    </div>
  );
}
