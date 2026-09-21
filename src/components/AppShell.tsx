"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useT, LocaleToggle, ThemeToggle } from "./Providers";

type Biz = { id: string; name: string; role: string };

const NAV: { href: string; tkey: string; icon: string; section?: string }[] = [
  { href: "/dashboard", tkey: "dashboard", icon: "▦", section: "business" },
  { href: "/parties", tkey: "parties", icon: "👥" },
  { href: "/inventory", tkey: "inventory", icon: "📦" },
  { href: "/sales-invoices", tkey: "sales", icon: "🏷️" },
  { href: "/purchase", tkey: "purchase", icon: "🛒" },
  { href: "/expense", tkey: "expense", icon: "🧾" },
  { href: "/income", tkey: "other_income", icon: "💵" },
  { href: "/accounts", tkey: "manage_accounts", icon: "🏦" },
  { href: "/reports", tkey: "reports", icon: "📊", section: "management" },
  { href: "/reminders", tkey: "reminders", icon: "🔔" },
  { href: "/staffs", tkey: "manage_staffs", icon: "🧑‍💼" },
  { href: "/audit", tkey: "audit_log", icon: "🕵️" },
  { href: "/settings", tkey: "settings", icon: "⚙️" },
];

export default function AppShell({
  user, role, businesses, activeBusinessId, businessName, children,
}: {
  user: { name: string; email: string };
  role: string;
  businesses: Biz[];
  activeBusinessId: string;
  businessName: string;
  children: React.ReactNode;
}) {
  const { t } = useT();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
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

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <aside
        className="scroll-thin"
        style={{
          width: 244, flexShrink: 0, background: "var(--card)", borderRight: "1px solid var(--border)",
          padding: "1rem .75rem", position: "sticky", top: 0, height: "100vh", overflowY: "auto",
          transform: open ? "none" : undefined,
        }}
        data-open={open}
      >
        <div style={{ display: "flex", alignItems: "center", gap: ".5rem", padding: "0 .5rem 1rem" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" width={30} height={30} style={{ borderRadius: 8 }} />
          <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--brand)" }}>{t("app_name")}</span>
        </div>

        {/* Business switcher */}
        <div style={{ position: "relative", marginBottom: "1rem" }}>
          <button className="btn" style={{ width: "100%", justifyContent: "space-between" }} onClick={() => setBizOpen(!bizOpen)}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🏢 {businessName}</span>
            <span>⌄</span>
          </button>
          {bizOpen && (
            <div className="card" style={{ position: "absolute", zIndex: 30, width: "100%", marginTop: 4, padding: ".35rem" }}>
              {businesses.map((b) => (
                <button
                  key={b.id}
                  onClick={() => switchBiz(b.id)}
                  className="btn"
                  style={{ width: "100%", justifyContent: "flex-start", border: "none", background: b.id === activeBusinessId ? "var(--green-soft)" : "transparent" }}
                >
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
          <div className="text-muted" style={{ fontSize: ".7rem", padding: ".5rem .5rem .25rem", textTransform: "uppercase", letterSpacing: ".05em" }}>{t("business")}</div>
          {NAV.filter((n) => !n.section || n.section === "business").map((n) => (
            <NavItem key={n.href} href={n.href} icon={n.icon} label={t(n.tkey)} active={isActive(n.href)} />
          ))}
          <div className="text-muted" style={{ fontSize: ".7rem", padding: ".75rem .5rem .25rem", textTransform: "uppercase", letterSpacing: ".05em" }}>{t("management")}</div>
          {NAV.filter((n) => n.section === "management").map((n) => (
            <NavItem key={n.href} href={n.href} icon={n.icon} label={t(n.tkey)} active={isActive(n.href)} />
          ))}
        </nav>
      </aside>

      {/* Main */}
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

function NavItem({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      style={{
        display: "flex", alignItems: "center", gap: ".6rem", padding: ".55rem .7rem", borderRadius: ".55rem",
        fontWeight: 600, fontSize: ".9rem", textDecoration: "none",
        background: active ? "var(--brand)" : "transparent",
        color: active ? "#fff" : "var(--text)",
      }}
    >
      <span style={{ width: 18, textAlign: "center" }}>{icon}</span>
      {label}
    </Link>
  );
}
