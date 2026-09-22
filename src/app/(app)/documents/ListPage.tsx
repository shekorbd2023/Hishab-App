import { redirect } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import { listDocs, editorSettings } from "@/lib/editorData";
import DocList from "@/components/DocList";
import type { DocKind } from "./kinds";

/** Server wrapper shared by the 5 transaction list routes. */
export default async function ListPage({ kind }: { kind: DocKind }) {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const bid = ctx.business.id;
  const rows = listDocs(bid, kind);
  const { prefix } = editorSettings(bid, kind);
  return <DocList kind={kind} rows={rows} prefix={prefix} />;
}
