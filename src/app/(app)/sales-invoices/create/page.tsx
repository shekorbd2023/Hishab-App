import { redirect } from "next/navigation";

const ALLOWED = new Set(["sales_invoice", "quotation", "sales_return"]);

export default async function CreateSales({ searchParams }: { searchParams: Promise<{ kind?: string; party?: string }> }) {
  const sp = await searchParams;
  const kind = ALLOWED.has(sp.kind || "") ? sp.kind! : "sales_invoice";
  redirect(`/documents/new?kind=${kind}${sp.party ? `&party=${encodeURIComponent(sp.party)}` : ""}`);
}
