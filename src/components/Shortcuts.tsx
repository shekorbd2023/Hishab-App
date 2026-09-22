"use client";
// Karbar-style global keyboard shortcuts + the "Keyboard Shortcuts" dialog (Shift+K).
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./ui";

type Sc = { label: string; keys: string[]; code: string; mod: "alt" | "shift"; href?: string; action?: "dialog" | "sidebar" };

export const ADDING: Sc[] = [
  { label: "Sales Invoice", keys: ["Alt", "S"], code: "KeyS", mod: "alt", href: "/documents/new?kind=sales_invoice" },
  { label: "Purchase Invoice", keys: ["Alt", "P"], code: "KeyP", mod: "alt", href: "/documents/new?kind=purchase_bill" },
  { label: "Payment In", keys: ["Alt", "I"], code: "KeyI", mod: "alt", href: "/payment-in?new=1" },
  { label: "Payment Out", keys: ["Alt", "O"], code: "KeyO", mod: "alt", href: "/payment-out?new=1" },
  { label: "Sales Return", keys: ["Alt", "C"], code: "KeyC", mod: "alt", href: "/documents/new?kind=sales_return" },
  { label: "Purchase Return", keys: ["Alt", "D"], code: "KeyD", mod: "alt", href: "/documents/new?kind=purchase_return" },
  { label: "Quotation", keys: ["Alt", "Q"], code: "KeyQ", mod: "alt", href: "/documents/new?kind=quotation" },
  { label: "Expense", keys: ["Alt", "E"], code: "KeyE", mod: "alt", href: "/expense?new=1" },
  { label: "Add Item", keys: ["Alt", "M"], code: "KeyM", mod: "alt", href: "/inventory/add" },
  { label: "Party", keys: ["Alt", "N"], code: "KeyN", mod: "alt", href: "/parties?new=1" },
];

export const PAGES: Sc[] = [
  { label: "Dashboard", keys: ["Shift", "D"], code: "KeyD", mod: "shift", href: "/dashboard" },
  { label: "Parties", keys: ["Shift", "P"], code: "KeyP", mod: "shift", href: "/parties" },
  { label: "Inventory", keys: ["Shift", "I"], code: "KeyI", mod: "shift", href: "/inventory" },
  { label: "Expense", keys: ["Shift", "E"], code: "KeyE", mod: "shift", href: "/expense" },
  { label: "Quick POS", keys: ["Shift", "Q"], code: "KeyQ", mod: "shift", href: "/pos" },
  { label: "Settings", keys: ["Shift", "S"], code: "KeyS", mod: "shift", href: "/settings/general" },
  { label: "Reports", keys: ["Shift", "R"], code: "KeyR", mod: "shift", href: "/reports" },
  { label: "Help & Support", keys: ["Shift", "H"], code: "KeyH", mod: "shift", href: "/help" },
  { label: "Keyboard Shortcuts", keys: ["Shift", "K"], code: "KeyK", mod: "shift", action: "dialog" },
  { label: "Toggle Sidebar", keys: ["Shift", "M"], code: "KeyM", mod: "shift", action: "sidebar" },
];

function isTyping(el: EventTarget | null): boolean {
  const n = el as HTMLElement | null;
  if (!n || !n.tagName) return false;
  const tag = n.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || n.isContentEditable;
}

export default function Shortcuts({ open, setOpen, toggleSidebar }: { open: boolean; setOpen: (v: boolean) => void; toggleSidebar: () => void }) {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.repeat) return;
      if (isTyping(e.target)) return;
      let list: Sc[] | null = null;
      if (e.altKey && !e.shiftKey) list = ADDING;
      else if (e.shiftKey && !e.altKey) list = PAGES;
      if (!list) return;
      const sc = list.find((s) => s.code === e.code);
      if (!sc) return;
      e.preventDefault();
      if (sc.action === "dialog") setOpen(true);
      else if (sc.action === "sidebar") toggleSidebar();
      else if (sc.href) { setOpen(false); router.push(sc.href); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, setOpen, toggleSidebar]);

  if (!open) return null;
  return (
    <Modal title="Keyboard Shortcuts" onClose={() => setOpen(false)} width={680}>
      <div className="sc-grid">
        <ScList title="Adding Transactions" list={ADDING} />
        <ScList title="Go to Pages" list={[...PAGES, { label: "Close Dialog", keys: ["Esc"], code: "", mod: "shift" }]} />
      </div>
    </Modal>
  );
}

function ScList({ title, list }: { title: string; list: Sc[] }) {
  return (
    <div>
      <div className="sc-title">{title}</div>
      {list.map((s) => (
        <div key={s.label} className="sc-row">
          <span>{s.label}</span>
          <span className="row" style={{ gap: 4 }}>
            {s.keys.map((k, i) => (
              <span key={k} className="row" style={{ gap: 4 }}>
                {i > 0 && <span className="text-muted" style={{ fontSize: 11 }}>+</span>}
                <span className="kbd">{k}</span>
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}
