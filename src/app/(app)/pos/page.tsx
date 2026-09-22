import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import { editorData, editorSettings, peekNextNumber } from "@/lib/editorData";
import POSClient from "./POSClient";

export const dynamic = "force-dynamic";

export default async function POSPage() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const bid = ctx.business.id;
  const { parties, items, accounts } = editorData(bid);
  const settings = editorSettings(bid, "sales_invoice");
  return (
    <POSClient
      items={items.filter((i) => i.type !== "Service" || true)}
      parties={parties.filter((p) => p.type !== "supplier")}
      accounts={accounts}
      settings={settings}
      nextNo={peekNextNumber(bid, "sales_invoice")}
    />
  );
}
