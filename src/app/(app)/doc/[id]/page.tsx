import { redirect, notFound } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import { all } from "@/lib/db";
import InvoiceDocument, { ThermalInvoice, DOC_NAME } from "@/components/InvoiceDocument";
import { PrintStage } from "@/components/PrintBar";
import { loadInvoice, paymentPickers } from "../load";
import DocBar from "./DocBar";

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
  const loaded = loadInvoice(bid, id);
  if (!loaded) notFound();
  const { data, settings, letterhead, partyId, partyPhone } = loaded;

  const thermal = sp.thermal === "1" || (settings.print_type === "thermal" && sp.regular !== "1");
  const pageCss = thermal
    ? `@page { size: ${settings.thermal_width === 58 ? 58 : 80}mm auto; margin: 0; }`
    : `@page { size: ${settings.page_size === "A5" ? "A5" : "A4"}; margin: 10mm; }`;
  const name = DOC_NAME[data.kind] || "Invoice";
  const fileName = `${name.replace(/ /g, "-")}-${data.number}${data.party ? "-" + data.party.name.replace(/[^\p{L}\p{N}]+/gu, "-") : ""}`;
  const { parties, accounts } = paymentPickers(bid);
  const next = all<{ kind: string; value: number }>("SELECT kind, value FROM counters WHERE business_id=?", [bid]);
  const nextOf = (k: string) => (next.find((c) => c.kind === k)?.value ?? 0) + 1;
  const due = Math.max(0, Math.round((data.total - data.received) * 100) / 100);
  const summary = `${ctx.business.name}\n${name} #${data.number} · ${data.date}\n` +
    data.lines.map((l) => `• ${l.name} × ${l.qty} = Tk. ${l.amount.toLocaleString("en-US")}`).join("\n") +
    (data.charges.length ? "\n" + data.charges.map((c) => `${c.title}: Tk. ${c.amount.toLocaleString("en-US")}`).join("\n") : "") +
    `\nTotal: Tk. ${data.total.toLocaleString("en-US")}` + (due > 0 ? `\nDue: Tk. ${due.toLocaleString("en-US")}` : "") + `\nThank you!`;

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
    </div>
  );
}
