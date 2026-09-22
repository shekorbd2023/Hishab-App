import { redirect, notFound } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import ReceiptDocument, { ThermalReceipt } from "@/components/ReceiptDocument";
import { PrintStage } from "@/components/PrintBar";
import { loadReceipt, paymentPickers } from "../../doc/load";
import ReceiptBar from "./ReceiptBar";

export const dynamic = "force-dynamic";

export default async function ReceiptPreview({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const bid = ctx.business.id;
  const loaded = loadReceipt(bid, id);
  if (!loaded) notFound();
  const { data, settings, letterhead, raw } = loaded;
  const thermal = sp.thermal === "1" || (settings.print_type === "thermal" && sp.regular !== "1");
  const pageCss = thermal
    ? `@page { size: ${settings.thermal_width === 58 ? 58 : 80}mm auto; margin: 0; }`
    : `@page { size: ${settings.page_size === "A5" ? "A5" : "A4"}; margin: 10mm; }`;
  const isIn = data.kind === "in";
  const title = `${isIn ? "Payment In" : "Payment Out"} #${data.number}`;
  const fileName = `${isIn ? "Payment-Receipt" : "Payment-Voucher"}-${data.number}${data.party ? "-" + data.party.name.replace(/[^\p{L}\p{N}]+/gu, "-") : ""}`;
  const { parties, accounts } = paymentPickers(bid);
  return (
    <div>
      <ReceiptBar
        title={title} backHref={raw.document_id ? `/doc/${raw.document_id}` : isIn ? "/payment-in" : "/payment-out"}
        fileName={fileName} thermal={thermal} payment={raw} parties={parties} accounts={accounts}
      />
      <PrintStage pageCss={pageCss}>
        {thermal ? <ThermalReceipt data={data} lh={letterhead} settings={settings} /> : <ReceiptDocument data={data} lh={letterhead} settings={settings} />}
      </PrintStage>
    </div>
  );
}
