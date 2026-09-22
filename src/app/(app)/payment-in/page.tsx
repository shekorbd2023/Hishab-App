import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import PaymentList from "./PaymentList";
import { loadPayments } from "./load";

export const dynamic = "force-dynamic";

export default async function Page() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const d = loadPayments(ctx.business.id, "in");
  return <Suspense><PaymentList kind="in" rows={d.rows} parties={d.parties} accounts={d.accounts} nextNumber={d.nextNumber} /></Suspense>;
}
