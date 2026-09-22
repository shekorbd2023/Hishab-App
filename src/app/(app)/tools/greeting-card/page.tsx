import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import GreetingCardClient from "./GreetingCardClient";

export const dynamic = "force-dynamic";

export default async function GreetingCardPage() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  return <GreetingCardClient business={ctx.business.name} logo={ctx.business.logo || ""} />;
}
