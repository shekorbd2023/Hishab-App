import { redirect } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import AccountForm from "./AccountForm";

export const dynamic = "force-dynamic";

export default async function Page() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  return <AccountForm name={ctx.user.name} email={ctx.user.email} role={ctx.role} />;
}
