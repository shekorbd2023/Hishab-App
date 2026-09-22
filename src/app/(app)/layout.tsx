import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser, getActiveBusiness, businessesForUser } from "@/lib/auth";
import { isLocale, type Locale } from "@/lib/i18n";
import { Providers } from "@/components/Providers";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ab = await getActiveBusiness(user.id);
  if (!ab) redirect("/login");

  const jar = await cookies();
  const lc = jar.get("hishab_locale")?.value;
  const locale: Locale = isLocale(lc) ? lc : "en";

  const businesses = businessesForUser(user.id).map((b) => ({ id: b.id, name: b.name, role: b.role, logo: b.logo || null }));

  return (
    <Providers locale={locale}>
      <AppShell
        user={user}
        role={ab.role}
        businesses={businesses}
        activeBusinessId={ab.business.id}
        businessName={ab.business.name}
        businessLogo={ab.business.logo || null}
      >
        {children}
      </AppShell>
    </Providers>
  );
}
