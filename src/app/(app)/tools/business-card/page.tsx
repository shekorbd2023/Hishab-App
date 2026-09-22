import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import BusinessCardClient from "./BusinessCardClient";

export const dynamic = "force-dynamic";

export default async function BusinessCardPage() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  return (
    <BusinessCardClient
      initial={{
        name: ctx.user.name,
        business: ctx.business.name,
        address: ctx.business.address || "",
        phone: ctx.business.phone || "",
        email: ctx.user.email,
        logo: ctx.business.logo || "",
      }}
    />
  );
}
