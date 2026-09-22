"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useT, LocaleToggle, ThemeToggle } from "./Providers";

type Biz = { id: string; name: string; role: string; logo?: string | null };

const NAV: { href: string; label: string; icon: string; section: string }[] = [
  { href: "/dashboard", label: "dashboard", icon: "▦", section: "business" },
  { href: "/parties", label: "parties", icon: "👥", section: "business" },
  { href: "/inventory", label: "inventory", icon: "📦", section: "business" },
  { href: "/sales-invoices", label: "sales", icon: "🏷️", section: "business" },
  { href: "/purchase", label: "purchase", icon: "🛒", section: "business" },
  { href: "/expense", label: "expense", icon: "🧾", section: "business" },
  { href: "/income", label: "other_income", icon: "💵", section: "business" },
  { href: "/accounts", label: "manage_accounts", icon: "🏦", section: "business" },
  { href: "/reports", label: "reports", icon: "📊", section: "management" },
  { href: "/reminders", label: "reminders", icon: "🔔", section: "management" },
  { href: "/staffs", label: "manage_staffs", icon: "🧑‍💼", section: "management" },
  { href: "/audit", label: "audit_log", icon: "🕵️", section: "management" },
  { href: "/settings", label: "settings", icon: "⚙️", section: "management" },
  { href: "/tools/business-card", label: "Business Cards", icon: "💳", section: "tools" },
  { href: "/tools/greeting-card", label: "Greeting Cards", icon: "🎉", section: "tools" },
  { href: "/tools/barcode", label: "Barcode Generator", icon: "▮▯", section: "tools" },
  { href: "/tools/bill-gallery", label: "Bill Gallery", icon: "🖼️", section: "tools" },
  { href: "/import", label: "Import Data", icon: "📥", section: "others" },
  { href: "/help", label: "Help & Support", icon: "❓", section: "others" },
  { href: "/tutorials", label: "Tutorials", icon: "🎬", section: "others" },
  { href: "/whats-new", label: "What's New", icon: "✨", section: "others" },
];

export default function AppShell({
  user, role, businesses, activeBusinessId, businessName, businessLogo, children,
}: {
  user: { name: string; email: string };
  role: string;
  businesses: Biz[];
  activeBusinessId: string;
  businessName: string;
  businessLogo?: string | null;
  children: React.ReactNode;
}) {
  const { t } = useT();
  const pathname = usePathname();
  const router = useRouter();
  const [bizOpen, setBizOpen] = useState(false);

  function switchBiz(id: string) {
    document.cookie = `hishab_business=${id}; path=/; max-age=${60 * 60 * 24 * 60}`;
    setBizOpen(false);
    router.refresh();
    router.push("/dashboard");
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }
  const isActive = (href: string) => pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  const label = (k: string) => t(k); // snake keys translate; readable labels pass through

  const SECTIONS: { key: string; title: string }[] = [
    { key: "business", title: t("business") },
    { key: "management", title: t("management") },
    { key: "tools", title: "Business Tools" },
    { key: "others", title: "Others" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside className="scroll-thin" style={{ width: 244, flexShrink: 0, background: "var(--card)", borderRight: "1px solid var(--border)", padding: "1rem .75rem", position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
        {/* App brand */}
        <div style={{ display: "flex", alignItems: "center", gap: ".5rem", padding: "0 .5rem .75rem" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" width={30} height={30} style={{ borderRadius: 8 }} />
          <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--brand)" }}>{t("app_name")}</span>
        </div>

        {/* Business switcher — shows the business's own logo */}
        <div style={{ position: "relative", marginBottom: "1rem" }}>
          <button className="btn" style={{ width: "100%", justifyContent: "space-between", height: 48 }} onClick={() => setBizOpen(!bizOpen)}>
            <span style={{ display: "flex", alignItems: "center", gap: ".5rem", overflow: "hidden" }}>
              <BizAvatar logo={businessLogo} name={businessName} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700 }}>{businessName}</span>
            </span>
            <span>⌄</span>
          </button>
          {bizOpen && (
            <div className="card" style={{ position: "absolute", zIndex: 30, width: "100%", marginTop: 4, padding: ".35rem" }}>
              {businesses.map((b) => (
                <button key={b.id} onClick={() => switchBiz(b.id)} className="btn"
                  style={{ width: "100%", justifyContent: "flex-start", gap: ".5rem", border: "none", background: b.id === activeBusinessId ? "var(--green-soft)" : "transparent" }}>
                  <BizAvatar logo={b.logo} name={b.name} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</span>
                  <span className="text-muted" style={{ fontSize: ".7rem", marginLeft: "auto" }}>{b.role}</span>
                </button>
              ))}
              <Link href="/business/new" className="btn" style={{ width: "100%", justifyContent: "flex-start", border: "none", color: "var(--brand)" }} onClick={() => setBizOpen(false)}>
                + {t("create_business")}
              </Link>
            </div>
          )}
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: ".15rem" }}>
          {SECTIONS.map((s) => (
            <div key={s.key}>
              <div className="text-muted" style={{ fontSize: ".7rem", padding: ".65rem .5rem .25rem", textTransform: "uppercase", letterSpacing: ".05em" }}>{s.title}</div>
              {NAV.filter((n) => n.section === s.key).map((n) => (
                <NavItem key={n.href} href={n.href} icon={n.icon} label={label(n.label)} active={isActive(n.href)} />
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header style={{ display: "flex", alignItems: "center", gap: ".6rem", padding: ".7rem 1rem", borderBottom: "1px solid var(--border)", background: "var(--card)", position: "sticky", top: 0, zIndex: 20 }}>
          <div style={{ display: "flex", gap: ".4rem", marginLeft: "auto" }}>
            <Link href="/pos" className="btn btn-primary">🧮 {t("quick_pos")}</Link>
            <Link href="/sales-invoices/create" className="btn">+ {t("add_sales")}</Link>
            <LocaleToggle />
            <ThemeToggle />
            <div style={{ position: "relative" }}>
              <details>
                <summary className="btn" style={{ listStyle: "none" }}>{user.name} ⌄</summary>
                <div className="card" style={{ position: "absolute", right: 0, marginTop: 4, padding: ".35rem", minWidth: 160, zIndex: 30 }}>
                  <div className="text-muted" style={{ fontSize: ".75rem", padding: ".35rem .5rem" }}>{user.email}</div>
                  <div className="text-muted" style={{ fontSize: ".75rem", padding: "0 .5rem .35rem" }}>{t("role")}: {role}</div>
                  <button className="btn btn-danger" style={{ width: "100%", justifyContent: "flex-start", border: "none" }} onClick={logout}>{t("logout")}</button>
                </div>
              </details>
            </div>
          </div>
        </header>
        <main style={{ padding: "1.25rem", flex: 1 }}>{children}</main>
      </div>
    </div>
  );
}

function BizAvatar({ logo, name }: { logo?: string | null; name: string }) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" width={28} height={28} style={{ borderRadius: 7, objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <span style={{ width: 28, height: 28, borderRadius: 7, background: "var(--brand)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: ".8rem", flexShrink: 0 }}>
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

function NavItem({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return (
    <Link href={href} style={{ display: "flex", alignItems: "center", gap: ".6rem", padding: ".55rem .7rem", borderRadius: ".55rem", fontWeight: 600, fontSize: ".9rem", textDecoration: "none", background: active ? "var(--brand)" : "transparent", color: active ? "#fff" : "var(--text)" }}>
      <span style={{ width: 18, textAlign: "center", fontSize: ".85rem" }}>{icon}</span>
      {label}
    </Link>
  );
}
