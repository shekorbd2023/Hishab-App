import { redirect } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import { get, all } from "@/lib/db";
import BusinessProfile from "./BusinessProfile";

export const dynamic = "force-dynamic";

export default async function Page() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const b = get<Record<string, string | null>>(
    "SELECT name, phone, email, address, logo, category, biz_type, division, district, reg_no FROM businesses WHERE id=?", [ctx.business.id]
  )!;
  const banks = all<{ name: string }>("SELECT name FROM accounts WHERE business_id=? AND type != 'cash'", [ctx.business.id]).length;
  return <BusinessProfile initial={b} bankCount={banks} canEdit={["Owner", "Admin", "Partner"].includes(ctx.role)} />;
}
