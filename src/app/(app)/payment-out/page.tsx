import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import PaymentList from "../payment-in/PaymentList";
import { loadPayments } from "../payment-in/load";

export const dynamic = "force-dynamic";

export default async function Page() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const d = loadPayments(ctx.business.id, "out");
  return <Suspense><PaymentList kind="out" rows={d.rows} parties={d.parties} accounts={d.accounts} nextNumber={d.nextNumber} /></Suspense>;
}
