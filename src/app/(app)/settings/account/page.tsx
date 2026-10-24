import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireCtx } from "@/lib/auth";
import { isLocalHeaders } from "@/lib/reset";
import AccountForm from "./AccountForm";

export const dynamic = "force-dynamic";

export default async function Page() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const h = await headers();
  const local = isLocalHeaders(h);
  return <AccountForm name={ctx.user.name} email={ctx.user.email} role={ctx.role} ownerOnDesktop={ctx.role === "Owner" && local} />;
}
