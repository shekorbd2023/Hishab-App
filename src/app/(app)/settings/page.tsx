import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/settings";
import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const s = getSettings(ctx.business.id);
  return (
    <SettingsForm
      business={{
        name: ctx.business.name,
        address: ctx.business.address || "",
        phone: ctx.business.phone || "",
        currency_symbol: ctx.business.currency_symbol || "Tk.",
        logo: ctx.business.logo || "",
      }}
      settings={s}
      canEdit={ctx.role === "Owner" || ctx.role === "Admin" || ctx.role === "Partner"}
    />
  );
}
