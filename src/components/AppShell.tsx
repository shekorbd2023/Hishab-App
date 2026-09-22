"use client";
// Karbar-style app shell: collapsible sidebar (business switcher + nav sections with inline submenus),
// sticky top bar (language, shortcuts, notifications, theme, profile), splash and keyboard shortcuts.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useT, applyTheme, readTheme, type ThemeChoice } from "./Providers";
import { Icon, Dropdown, useOutside } from "./ui";
import Shortcuts from "./Shortcuts";
import Splash from "./Splash";

type Biz = { id: string; name: string; role: string; logo?: string | null };
export type Notice = { kind: "stock" | "reminder"; id: string; title: string; text: string; href: string };

type NavLeaf = { href: string; label: string; icon: string; also?: string[] };
type NavGroup = { key: string; label: string; icon: string; children: NavLeaf[] };
type NavEntry = NavLeaf | NavGroup;
const isGroup = (n: NavEntry): n is NavGroup => "children" in n;

const SECTIONS: { title: string; items: NavEntry[] }[] = [
  {
    title: "business",
    items: [
      { href: "/dashboard", label: "dashboard", icon: "grid", also: ["/insights"] },
      { href: "/parties", label: "parties", icon: "users" },
      { href: "/inventory", label: "inventory", icon: "box" },
      {
        key: "sales", label: "sales", icon: "tag", children: [
          { href: "/sales-invoices", label: "sales_invoices", icon: "receipt" },
          { href: "/payment-in", label: "payment_in", icon: "arrowDown" },
          { href: "/quotations", label: "quotations", icon: "statement" },
          { href: "/sales-return", label: "sales_return", icon: "swap" },
        ],
      },
      {
        key: "purchase", label: "purchase", icon: "cart", children: [
          { href: "/purchase", label: "purchase_bills", icon: "receipt" },
          { href: "/payment-out", label: "payment_out", icon: "arrowUp" },
          { href: "/purchase-return", label: "purchase_return", icon: "swap" },
        ],
      },
      { href: "/expense", label: "expense", icon: "wallet" },
      { href: "/income", label: "other_income", icon: "income" },
      { href: "/accounts", label: "manage_accounts", icon: "bank" },
    ],
  },
  {
    title: "management",
    items: [
      { href: "/reports", label: "reports", icon: "chart" },
      { href: "/staffs", label: "manage_staffs", icon: "staff" },
      {
        key: "import", label: "import_data", icon: "import", children: [
          { href: "/import/parties", label: "import_parties", icon: "users" },
          { href: "/import/items", label: "import_items", icon: "box" },
        ],
      },
      {
        key: "tools", label: "business_tools", icon: "tools", children: [
          { href: "/tools/business-card", label: "business_cards", icon: "card" },
          { href: "/tools/greeting-card", label: "greeting_cards", icon: "gift" },
          { href: "/tools/barcode", label: "barcode_generator", icon: "barcode" },
          { href: "/tools/bill-gallery", label: "bill_gallery", icon: "image" },
        ],
      },
      { href: "/reminders", label: "reminders", icon: "reminder" },
      { href: "/audit", label: "audit_log", icon: "audit" },
      { href: "/backup", label: "backup_restore", icon: "backup" },
    ],
  },
  {
    title: "others",
    items: [
      { href: "/help", label: "help_support", icon: "help" },
      { href: "/tutorials", label: "tutorials", icon: "video" },
      { href: "/whats-new", label: "whats_new", icon: "sparkle" },
      { href: "/settings/general", label: "settings", icon: "settings", also: ["/settings"] },
    ],
  },
];

const matches = (path: string, href: string) => path === href || path.startsWith(href + "/");
const leafActive = (path: string, n: NavLeaf) => matches(path, n.href) || (n.also || []).some((a) => matches(path, a));

export default function AppShell({
  user, role, businesses, activeBusinessId, businessName, businessLogo, notices, children,
}: {
  user: { name: string; email: string };
  role: string;
  businesses: Biz[];
  activeBusinessId: string;
  businessName: string;
  businessLogo?: string | null;
  notices: Notice[];
  children: React.ReactNode;
}) {
  const { t, locale, setLocale } = useT();
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [mini, setMini] = useState(false);
  const [scOpen, setScOpen] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [theme, setTheme] = useState<ThemeChoice>("light");

  useEffect(() => {
    try { setMini(localStorage.getItem("hishab_sidebar") === "mini"); } catch { /* ignore */ }
    setTheme(readTheme());
  }, []);

  // Auto-open the submenu that contains the active route.
  useEffect(() => {
    for (const s of SECTIONS) for (const n of s.items) {
      if (isGroup(n) && n.children.some((c) => leafActive(pathname, c))) setOpen((o) => (o[n.key] ? o : { ...o, [n.key]: true }));
    }
  }, [pathname]);

  const toggleSidebar = useCallback(() => {
    setMini((m) => {
      try { localStorage.setItem("hishab_sidebar", m ? "full" : "mini"); } catch { /* ignore */ }
      return !m;
    });
  }, []);

  function switchBiz(id: string) {
    document.cookie = `hishab_business=${id}; path=/; max-age=${60 * 60 * 24 * 60}`;
    try { sessionStorage.removeItem("hishab_splash"); } catch { /* ignore */ }
    window.location.href = "/dashboard";
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    try { sessionStorage.removeItem("hishab_splash"); } catch { /* ignore */ }
    router.push("/login");
  }
  function pickTheme(c: ThemeChoice) { applyTheme(c); setTheme(c); }

  return (
    <div className={`hs-shell ${mini ? "mini" : ""}`}>
      <Splash businessName={businessName} businessLogo={businessLogo} />
      <Shortcuts open={scOpen} setOpen={setScOpen} toggleSidebar={toggleSidebar} />

      <aside className="hs-side scroll-thin">
        <Link href="/dashboard" className="hs-brand" title="Hishab">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" width={30} height={30} />
          <span className="hs-label">Hishab</span>
        </Link>

        <BizSwitcher
          mini={mini} businesses={businesses} activeId={activeBusinessId} name={businessName} logo={businessLogo}
          onSwitch={switchBiz} t={t}
        />

        <nav className="hs-nav">
          {SECTIONS.map((s) => (
            <div key={s.title} className="hs-sec">
              <div className="hs-sec-title">{mini ? <span className="hs-sec-rule" /> : t(s.title)}</div>
              {s.items.map((n) => {
                if (!isGroup(n)) {
                  return (
                    <Link key={n.href} href={n.href} className={`hs-item ${leafActive(pathname, n) ? "on" : ""}`} title={mini ? t(n.label) : undefined}>
                      <Icon name={n.icon} size={18} /><span className="hs-label">{t(n.label)}</span>
                    </Link>
                  );
                }
                const childOn = n.children.some((c) => leafActive(pathname, c));
                const isOpen = !!open[n.key];
                if (mini) {
                  return (
                    <Link key={n.key} href={n.children[0].href} className={`hs-item ${childOn ? "on" : ""}`} title={t(n.label)}>
                      <Icon name={n.icon} size={18} />
                    </Link>
                  );
                }
                return (
                  <div key={n.key}>
                    <button type="button" className={`hs-item ${childOn ? "parent-on" : ""}`} onClick={() => setOpen((o) => ({ ...o, [n.key]: !o[n.key] }))} aria-expanded={isOpen}>
                      <Icon name={n.icon} size={18} /><span className="hs-label">{t(n.label)}</span>
                      <Icon name="chevronRight" size={15} className={`hs-chev ${isOpen ? "open" : ""}`} />
                    </button>
                    {isOpen && (
                      <div className="hs-subs">
                        {n.children.map((c) => (
                          <Link key={c.href} href={c.href} className={`hs-item hs-subitem ${leafActive(pathname, c) ? "on" : ""}`}>
                            <span className="hs-dot" /><span className="hs-label">{t(c.label)}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <div className="hs-body">
        <header className="hs-top">
          <button type="button" className="btn btn-icon btn-ghost" onClick={toggleSidebar} title={`${t("toggle_sidebar")} (Shift+M)`} aria-label="Toggle sidebar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div style={{ flex: 1 }} />

          <button type="button" className="hs-lang" onClick={() => setLocale(locale === "en" ? "bn" : "en")} title={t("language")}>
            <span className="hs-flag" aria-hidden>{locale === "en" ? <FlagGB /> : <FlagBD />}</span>
            {locale === "en" ? "EN" : "বাং"}
            <Icon name="swap" size={13} style={{ color: "var(--muted)" }} />
          </button>

          <button type="button" className="btn btn-icon btn-ghost" onClick={() => setScOpen(true)} title={`${t("keyboard_shortcuts")} (Shift+K)`} aria-label="Keyboard shortcuts">
            <Icon name="keyboard" size={19} />
          </button>

          <NotificationBell notices={notices} t={t} />

          <Dropdown width={200} trigger={(tg) => (
            <button type="button" className="btn btn-icon btn-ghost" onClick={tg} title={t("theme")} aria-label="Theme">
              {theme === "dark" ? <Icon name="moon" size={18} /> : <SunIcon />}
            </button>
          )}>
            {(close) => (
              <>
                <div className="menu-label">{t("theme")}</div>
                {(["light", "dark", "classic", "system"] as ThemeChoice[]).map((c) => (
                  <button key={c} onClick={() => { pickTheme(c); close(); }}>
                    <span className={`hs-swatch hs-sw-${c}`} />
                    {t(c === "system" ? "system_default" : c)}
                    {theme === c && <Icon name="check" size={14} style={{ marginLeft: "auto", color: "var(--brand)" }} />}
                  </button>
                ))}
              </>
            )}
          </Dropdown>

          <Dropdown width={240} trigger={(tg, o) => (
            <button type="button" className={`hs-profile ${o ? "on" : ""}`} onClick={tg}>
              <span className="hs-pavatar">{(user.name || "?").trim().slice(0, 1).toUpperCase()}</span>
              <span className="hs-pname">{user.name}</span>
              <Icon name="chevronDown" size={14} />
            </button>
          )}>
            {(close) => (
              <>
                <div style={{ padding: ".55rem .65rem .45rem" }}>
                  <div style={{ fontWeight: 700 }}>{user.name}</div>
                  <div className="sub">{user.email}</div>
                  <div className="sub">{t("role")}: {role}</div>
                </div>
                <div className="sep" />
                <Link href="/settings/account" onClick={close}><Icon name="user" size={15} />{t("my_profile")}</Link>
                <Link href="/settings/business-profile" onClick={close}><Icon name="image" size={15} />{t("business_profile")}</Link>
                <div className="sep" />
                <button className="danger" onClick={() => { close(); logout(); }}><Icon name="logout" size={15} />{t("logout")}</button>
              </>
            )}
          </Dropdown>
        </header>
        <main className="hs-main">{children}</main>
      </div>
    </div>
  );
}

/* ---------------- Business switcher ---------------- */
function BizAvatar({ logo, name, size = 34 }: { logo?: string | null; name: string; size?: number }) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" width={size} height={size} className="hs-bizlogo" style={{ width: size, height: size }} />;
  }
  return <span className="hs-bizlogo hs-bizinit" style={{ width: size, height: size }}>{(name || "?").trim().slice(0, 1).toUpperCase()}</span>;
}

function BizSwitcher({ mini, businesses, activeId, name, logo, onSwitch, t }: {
  mini: boolean; businesses: Biz[]; activeId: string; name: string; logo?: string | null; onSwitch: (id: string) => void; t: (k: string) => string;
}) {
  const [o, setO] = useState(false);
  const ref = useOutside<HTMLDivElement>(o, () => setO(false));
  return (
    <div ref={ref} className="hs-biz-wrap">
      <button type="button" className="hs-biz" onClick={() => setO(!o)} title={name}>
        <BizAvatar logo={logo} name={name} />
        <span className="hs-label hs-bizname">{name}</span>
        <svg className="hs-label" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted)", flexShrink: 0 }}><path d="m7 9 5-5 5 5M7 15l5 5 5-5" /></svg>
      </button>
      {o && (
        <div className="menu hs-biz-menu">
          <div className="menu-label">{t("switch_business")}</div>
          {businesses.map((b) => (
            <button key={b.id} onClick={() => (b.id === activeId ? setO(false) : onSwitch(b.id))} style={{ background: b.id === activeId ? "var(--brand-soft)" : undefined }}>
              <BizAvatar logo={b.logo} name={b.name} size={28} />
              <span style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</div>
                <div className="sub">{b.role}</div>
              </span>
              {b.id === activeId && <Icon name="check" size={14} style={{ color: "var(--brand)" }} />}
            </button>
          ))}
          <div className="sep" />
          <Link href="/settings/business-profile" onClick={() => setO(false)}><Icon name="image" size={15} />{t("edit_business_profile")}</Link>
          <Link href="/business/new" onClick={() => setO(false)} style={{ color: "var(--brand)", fontWeight: 600 }}><Icon name="plus" size={15} />{t("create_business")}</Link>
        </div>
      )}
    </div>
  );
}

/* ---------------- Notifications ---------------- */
function NotificationBell({ notices, t }: { notices: Notice[]; t: (k: string) => string }) {
  const [tab, setTab] = useState<"all" | "stock" | "reminder">("all");
  const shown = notices.filter((n) => tab === "all" || n.kind === tab);
  const nStock = notices.filter((n) => n.kind === "stock").length;
  return (
    <Dropdown width={360} trigger={(tg) => (
      <button type="button" className="btn btn-icon btn-ghost hs-bell" onClick={tg} title={t("notifications")} aria-label="Notifications">
        <Icon name="bell" size={19} />
        {notices.length > 0 && <span className="hs-badge">{notices.length > 99 ? "99+" : notices.length}</span>}
      </button>
    )}>
      {(close) => (
        <div>
          <div className="between" style={{ padding: ".45rem .6rem .35rem" }}>
            <b style={{ fontSize: 14 }}>{t("notifications")}</b>
            <div className="seg" style={{ gap: 4 }}>
              {([["all", "All"], ["stock", `${t("low_stock_items")} (${nStock})`], ["reminder", `${t("reminders")} (${notices.length - nStock})`]] as const).map(([k, l]) => (
                <button key={k} className={tab === k ? "on" : ""} style={{ height: 26, padding: "0 .5rem", fontSize: 11.5 }} onClick={() => setTab(k)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="sep" />
          <div className="scroll-thin" style={{ maxHeight: 360, overflow: "auto" }}>
            {shown.length === 0 && (
              <div className="empty" style={{ padding: "1.5rem .5rem" }}>
                <Icon name="bell" size={28} stroke={1.4} />
                <div>{t("no_notifications")}</div>
              </div>
            )}
            {shown.map((n) => (
              <div key={n.kind + n.id} className="hs-note">
                <span className={`hs-note-ic ${n.kind}`}><Icon name={n.kind === "stock" ? "box" : "reminder"} size={16} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</div>
                  <div className="sub">{n.text}</div>
                </div>
                <Link href={n.href} onClick={close} className="btn btn-sm btn-soft" style={{ width: "auto" }}>{n.kind === "stock" ? "Add Stock" : "View"}</Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </Dropdown>
  );
}

/* ---------------- Tiny inline art ---------------- */
function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
function FlagBD() {
  return <svg width="20" height="13" viewBox="0 0 20 12"><rect width="20" height="12" rx="2" fill="#006a4e" /><circle cx="9" cy="6" r="3.6" fill="#f42a41" /></svg>;
}
function FlagGB() {
  return (
    <svg width="20" height="13" viewBox="0 0 60 36">
      <rect width="60" height="36" rx="5" fill="#012169" />
      <path d="M0 0 60 36M60 0 0 36" stroke="#fff" strokeWidth="7" /><path d="M0 0 60 36M60 0 0 36" stroke="#c8102e" strokeWidth="3" />
      <path d="M30 0v36M0 18h60" stroke="#fff" strokeWidth="11" /><path d="M30 0v36M0 18h60" stroke="#c8102e" strokeWidth="6" />
    </svg>
  );
}
