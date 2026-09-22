import { redirect } from "next/navigation";

const ALLOWED = new Set(["purchase_bill", "purchase_return"]);

export default async function CreatePurchase({ searchParams }: { searchParams: Promise<{ kind?: string; party?: string }> }) {
  const sp = await searchParams;
  const kind = ALLOWED.has(sp.kind || "") ? sp.kind! : "purchase_bill";
  redirect(`/documents/new?kind=${kind}${sp.party ? `&party=${encodeURIComponent(sp.party)}` : ""}`);
}
