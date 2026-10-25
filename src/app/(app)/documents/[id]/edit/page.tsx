import { notFound, redirect } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import { editorData, editorSettings, loadDocForEdit } from "@/lib/editorData";
import DocumentEditor from "@/components/DocumentEditor";
import { isDocKind } from "../../kinds";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Transaction" };

export default async function EditDocument({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const { id } = await params;
  const bid = ctx.business.id;
  const doc = (await loadDocForEdit(bid, id));
  if (!doc || !isDocKind(doc.kind)) notFound();
  const { parties, items, accounts } = (await editorData(bid));
  return (
    <DocumentEditor
      key={doc.id}
      kind={doc.kind}
      parties={parties}
      items={items}
      accounts={accounts}
      settings={(await editorSettings(bid, doc.kind))}
      nextNumber={doc.number}
      doc={doc}
    />
  );
}
