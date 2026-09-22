import { redirect } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import TransactionsSettings from "./TransactionsSettings";

export const dynamic = "force-dynamic";

export default async function Page() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  return <TransactionsSettings initial={getSettings(ctx.business.id)} business={{ name: ctx.business.name, logo: ctx.business.logo, phone: ctx.business.phone }} />;
}
