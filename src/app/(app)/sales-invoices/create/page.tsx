import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import { editorData, peekNextNumber } from "@/lib/editorData";
import DocumentEditor from "@/components/DocumentEditor";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["sales_invoice", "quotation", "sales_return"]);

export default async function CreateSales({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const sp = await searchParams;
  const kind = ALLOWED.has(sp.kind || "") ? sp.kind! : "sales_invoice";
  const { parties, items, accounts } = editorData(ctx.business.id);
  return (
    <DocumentEditor
      kind={kind}
      parties={parties}
      items={items}
      accounts={accounts}
      nextNumber={peekNextNumber(ctx.business.id, kind)}
      symbol={ctx.business.currency_symbol}
    />
  );
}
