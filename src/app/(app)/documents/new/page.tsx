import { redirect } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import { editorData, editorSettings, peekNextNumber } from "@/lib/editorData";
import DocumentEditor from "@/components/DocumentEditor";
import { isDocKind, KIND } from "../kinds";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const sp = await searchParams;
  return { title: isDocKind(sp.kind) ? KIND[sp.kind].create : "Create Sales Invoice" };
}

export default async function NewDocument({ searchParams }: { searchParams: Promise<{ kind?: string; party?: string }> }) {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const sp = await searchParams;
  const kind = isDocKind(sp.kind) ? sp.kind : "sales_invoice";
  const bid = ctx.business.id;
  const { parties, items, accounts } = editorData(bid);
  return (
    <DocumentEditor
      key={kind}
      kind={kind}
      parties={parties}
      items={items}
      accounts={accounts}
      settings={editorSettings(bid, kind)}
      nextNumber={peekNextNumber(bid, kind)}
      initialPartyId={sp.party && parties.some((p) => p.id === sp.party) ? sp.party : null}
    />
  );
}
