"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Avatar, FilterSelect, SearchBox, SplitButton, useToast } from "@/components/ui";
import PartyForm from "@/components/PartyForm";
import { tk } from "@/lib/format";

export type PartyRow = {
  id: string; name: string; phone: string | null; type: string; category: string | null;
  photo: string | null; created_at: string; balance: number;
};

export function balTone(b: number) {
  return b > 0.004 ? "pos" : b < -0.004 ? "neg" : "settled";
}
export function balLabel(b: number) {
  return b > 0.004 ? "To Receive" : b < -0.004 ? "To Give" : "Settled";
}

export default function PartiesShell({ parties, categories, children }: { parties: PartyRow[]; categories: string[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const { toast, node } = useToast();
  const activeId = pathname.startsWith("/parties/") ? pathname.split("/")[2] : null;

  const initialPay = sp.get("filter") === "receivable" || sp.get("party-payment-type") === "receivable" ? "receive"
    : sp.get("filter") === "payable" || sp.get("party-payment-type") === "payable" ? "give" : "all";
  const [q, setQ] = useState("");
  const [ptype, setPtype] = useState("all");
  const [pay, setPay] = useState(initialPay);
  const [cat, setCat] = useState("all");
  const [adding, setAdding] = useState(sp.get("new") === "1");

  useEffect(() => { setPay(initialPay); }, [initialPay]);
  useEffect(() => { if (sp.get("new") === "1") setAdding(true); }, [sp]);

  const totals = useMemo(() => {
    let r = 0, g = 0;
    for (const p of parties) { if (p.balance > 0) r += p.balance; else g -= p.balance; }
    return { r: Math.round(r * 100) / 100, g: Math.round(g * 100) / 100 };
  }, [parties]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return parties.filter((p) => {
      if (s && !p.name.toLowerCase().includes(s) && !(p.phone || "").includes(s)) return false;
      if (ptype === "customer" && p.type === "supplier") return false;
      if (ptype === "supplier" && p.type === "customer") return false;
      const t = balTone(p.balance);
      if (pay === "receive" && t !== "pos") return false;
      if (pay === "give" && t !== "neg") return false;
      if (pay === "settled" && t !== "settled") return false;
      if (cat !== "all" && (p.category || "") !== cat) return false;
      return true;
    });
  }, [parties, q, ptype, pay, cat]);

  function closeAdd() {
    setAdding(false);
    if (sp.get("new")) router.replace(pathname);
  }

  return (
    <div className={`two-pane ${activeId ? "has-detail" : ""}`}>
      <div className="pane-list">
        <div className="pane-head">
          <div className="md-pane-title">
            <h1>Parties ({parties.length})</h1>
            <SplitButton label="Add Party" icon="plus" onClick={() => setAdding(true)}
              items={[{ label: "Import Parties", icon: "import", href: "/import/parties" }]} />
          </div>
          <SearchBox value={q} onChange={setQ} placeholder="Search parties…" width="100%" />
          <div className="md-filters">
            <FilterSelect value={ptype} onChange={setPtype} options={[{ v: "all", l: "All Party" }, { v: "customer", l: "Customer" }, { v: "supplier", l: "Supplier" }]} />
            <FilterSelect value={pay} onChange={setPay} options={[{ v: "all", l: "All Payment" }, { v: "receive", l: "To Receive" }, { v: "give", l: "To Give" }, { v: "settled", l: "Settled" }]} />
            {categories.length > 0 && (
              <FilterSelect value={cat} onChange={setCat} options={[{ v: "all", l: "All Category" }, ...categories.map((c) => ({ v: c, l: c }))]} />
            )}
          </div>
          <div className="md-mini">
            <button type="button" className={pay === "receive" ? "on-pos" : ""} onClick={() => setPay(pay === "receive" ? "all" : "receive")}>
              <div className="l">To Receive</div>
              <div className="v pos">{tk(totals.r)}</div>
            </button>
            <button type="button" className={pay === "give" ? "on-neg" : ""} onClick={() => setPay(pay === "give" ? "all" : "give")}>
              <div className="l">To Give</div>
              <div className="v neg">{tk(totals.g)}</div>
            </button>
          </div>
        </div>
        <div className="pane-body scroll-thin">
          {rows.map((p) => {
            const tone = balTone(p.balance);
            return (
              <Link key={p.id} href={`/parties/${p.id}`} className={`list-row ${activeId === p.id ? "active" : ""}`} prefetch={false}>
                <Avatar name={p.name} img={p.photo} />
                <div className="main">
                  <div className="name">{p.name}</div>
                  <div className="phone">{p.phone || "---"}</div>
                </div>
                <div className="right">
                  <div className={`amt ${tone}`}>{tk(Math.abs(p.balance))}</div>
                  <div className="lbl">{balLabel(p.balance)}</div>
                </div>
              </Link>
            );
          })}
          {rows.length === 0 && <div className="empty" style={{ padding: "2rem 1rem" }}>No parties match your filters.</div>}
        </div>
      </div>
      <div className="pane-detail scroll-thin">{children}</div>
      {adding && (
        <PartyForm
          categories={categories}
          onClose={closeAdd}
          onSaved={(id, andNew) => {
            toast("Party saved");
            if (andNew) { router.refresh(); return; }
            setAdding(false);
            router.push(`/parties/${id}`);
            router.refresh();
          }}
        />
      )}
      {node}
    </div>
  );
}
