"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BackButton, Icon } from "@/components/ui";

const TOP = [
  { href: "/settings/general", label: "General", icon: "settings" },
  { href: "/settings/account", label: "My Account", icon: "user" },
  { href: "/settings/business-profile", label: "Business Profile", icon: "image" },
];
const FEATURES = [
  { href: "/settings/features/parties", label: "Parties" },
  { href: "/settings/features/inventory", label: "Inventory" },
  { href: "/settings/features/transactions", label: "Transactions" },
  { href: "/settings/features/invoice-print", label: "Invoice Print" },
];

export default function SettingsNav() {
  const p = usePathname();
  return (
    <aside className="set-nav">
      <div className="set-nav-head"><BackButton href="/dashboard" /><span>Settings</span></div>
      {TOP.map((t) => (
        <Link key={t.href} href={t.href} className={`set-link ${p === t.href ? "on" : ""}`}><Icon name={t.icon} size={15} />{t.label}</Link>
      ))}
      <div className={`set-link set-group ${p.startsWith("/settings/features") ? "on-group" : ""}`}><Icon name="sparkle" size={15} />Feature Settings</div>
      {FEATURES.map((t) => (
        <Link key={t.href} href={t.href} className={`set-link set-sub ${p === t.href ? "on" : ""}`}>{t.label}</Link>
      ))}
    </aside>
  );
}
