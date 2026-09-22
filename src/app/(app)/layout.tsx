import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser, getActiveBusiness, businessesForUser } from "@/lib/auth";
import { isLocale, type Locale } from "@/lib/i18n";
import { all } from "@/lib/db";
import { itemStocks } from "@/lib/domain";
import { TODAY } from "@/lib/format";
import { Providers } from "@/components/Providers";
import AppShell, { type Notice } from "@/components/AppShell";

export const dynamic = "force-dynamic";

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ab = await getActiveBusiness(user.id);
  if (!ab) redirect("/login");
  const bid = ab.business.id;

  const jar = await cookies();
  const lc = jar.get("hishab_locale")?.value;
  const locale: Locale = isLocale(lc) ? lc : "en";

  const businesses = businessesForUser(user.id).map((b) => ({ id: b.id, name: b.name, role: b.role, logo: b.logo || null }));

  // Notifications: low-stock items + reminders due in the next 7 days (overdue included).
  const notices: Notice[] = [];
  const stocks = itemStocks(bid);
  const lowItems = all<{ id: string; name: string; unit: string | null; low_stock_alert: number }>(
    "SELECT id, name, unit, low_stock_alert FROM items WHERE business_id=? AND type!='Service' AND low_stock_alert > 0", [bid]
  );
  for (const it of lowItems) {
    const q = stocks[it.id] ?? 0;
    if (q <= it.low_stock_alert) {
      notices.push({ kind: "stock", id: it.id, title: it.name, text: `Only ${Math.round(q * 1000) / 1000} ${it.unit || ""} left (alert at ${it.low_stock_alert})`, href: `/inventory/${it.id}` });
    }
  }
  const today = TODAY();
  const rems = all<{ id: string; due_date: string; note: string | null; pname: string | null }>(
    `SELECT r.id, r.due_date, r.note, p.name pname FROM reminders r LEFT JOIN parties p ON p.id=r.party_id
     WHERE r.business_id=? AND r.done=0 AND r.due_date <= ? ORDER BY r.due_date LIMIT 30`, [bid, addDays(today, 7)]
  );
  for (const r of rems) {
    notices.push({ kind: "reminder", id: r.id, title: r.pname || r.note || "Reminder", text: `${r.due_date < today ? "Overdue · " : ""}Due ${r.due_date}${r.pname && r.note ? " · " + r.note : ""}`, href: "/reminders" });
  }

  return (
    <Providers locale={locale}>
      <AppShell
        user={{ name: user.name, email: user.email }}
        role={ab.role}
        businesses={businesses}
        activeBusinessId={bid}
        businessName={ab.business.name}
        businessLogo={ab.business.logo || null}
        notices={notices}
      >
        {children}
      </AppShell>
    </Providers>
  );
}
