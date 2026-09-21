"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/Providers";
import { api } from "@/lib/clientUtil";

type Item = { id: string; name: string; category: string | null; sales_price: number; code: string | null; unit: string | null; stock: number };
type Ref = { id: string; name: string };
const m = (n: number, s: string) => `${s} ${(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export default function POSClient({ items, accounts, parties, symbol }: { items: Item[]; accounts: Ref[]; parties: Ref[]; symbol: string }) {
  const { t } = useT();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [partyId, setPartyId] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [received, setReceived] = useState<number | "">("");
  const [held, setHeld] = useState<{ id: number; cart: Record<string, number>; partyId: string; total: number }[]>([]);

  const cats = useMemo(() => ["all", ...Array.from(new Set(items.map((i) => i.category).filter(Boolean))) as string[]], [items]);
  const shown = useMemo(() => items.filter((it) =>
    (cat === "all" || it.category === cat) &&
    (!q || it.name.toLowerCase().includes(q.toLowerCase()) || (it.code || "").includes(q))
  ), [items, q, cat]);

  const cartLines = Object.entries(cart).map(([id, qty]) => ({ item: items.find((i) => i.id === id)!, qty })).filter((c) => c.item);
  const total = cartLines.reduce((a, c) => a + c.item.sales_price * c.qty, 0);
  const add = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const setQty = (id: string, qty: number) => setCart((c) => { const n = { ...c }; if (qty <= 0) delete n[id]; else n[id] = qty; return n; });

  const paidEntered = received === "" ? total : Number(received);
  const change = paidEntered > total ? paidEntered - total : 0;
  const due = paidEntered < total ? total - paidEntered : 0;

  function holdBill() {
    if (cartLines.length === 0) return;
    setHeld((h) => [...h, { id: Date.now(), cart: { ...cart }, partyId, total }]);
    setCart({}); setReceived(""); setPartyId("");
  }
  function resumeBill(id: number) {
    const b = held.find((x) => x.id === id);
    if (!b) return;
    setCart(b.cart); setPartyId(b.partyId);
    setHeld((h) => h.filter((x) => x.id !== id));
  }

  async function checkout() {
    if (cartLines.length === 0) return;
    setBusy(true);
    const lines = cartLines.map((c) => ({ itemId: c.item.id, name: c.item.name, qty: c.qty, rate: c.item.sales_price, discountType: "flat", discountValue: 0, taxRate: 0 }));
    const { ok, data } = await api("/api/documents", {
      op: "create", kind: "sales_invoice", party_id: partyId || null, date: new Date().toISOString().slice(0, 10),
      payment_mode: "Cash", account_id: accountId || null, paid_amount: Math.min(paidEntered, total), lines,
    });
    setBusy(false);
    if (ok) router.push(`/doc/${data.id}`); else alert((data.error as string) || "Failed");
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: ".75rem", alignItems: "start" }}>
      <div>
        <div style={{ display: "flex", gap: ".5rem", marginBottom: ".75rem", flexWrap: "wrap" }}>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800 }}>{t("quick_pos")}</h1>
          <input className="input" placeholder={`${t("search")}…`} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260, marginLeft: "auto" }} />
        </div>
        <div style={{ display: "flex", gap: ".4rem", overflowX: "auto", paddingBottom: ".5rem", marginBottom: ".5rem" }} className="scroll-thin">
          {cats.map((c) => (
            <button key={c} className="btn" onClick={() => setCat(c)} style={{ whiteSpace: "nowrap", background: cat === c ? "var(--brand)" : undefined, color: cat === c ? "#fff" : undefined, borderColor: cat === c ? "var(--brand)" : undefined }}>
              {c === "all" ? t("all") : c}
            </button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: ".6rem" }}>
          {shown.map((it) => (
            <button key={it.id} className="card" onClick={() => add(it.id)} style={{ padding: ".8rem", textAlign: "left", cursor: "pointer" }}>
              <div style={{ fontWeight: 600, fontSize: ".9rem" }}>{it.name}</div>
              <div className="text-muted" style={{ fontSize: ".78rem", marginTop: ".3rem" }}>Qty: {it.stock} {it.unit}</div>
              <div style={{ fontWeight: 700, color: "var(--brand)", marginTop: ".2rem" }}>{m(it.sales_price, symbol)}</div>
            </button>
          ))}
          {shown.length === 0 && <p className="text-muted">{t("no_data")}</p>}
        </div>
      </div>

      <div className="card" style={{ padding: "1rem", position: "sticky", top: 70 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".5rem" }}>
          <h2 style={{ fontWeight: 700 }}>Cart ({cartLines.length})</h2>
          <button className="btn" style={{ padding: ".2rem .5rem", fontSize: ".8rem" }} onClick={holdBill} disabled={cartLines.length === 0}>⏸ Hold</button>
        </div>
        {held.length > 0 && (
          <div style={{ display: "flex", gap: ".3rem", flexWrap: "wrap", marginBottom: ".5rem" }}>
            {held.map((b) => (
              <button key={b.id} className="btn" style={{ padding: ".2rem .5rem", fontSize: ".78rem" }} onClick={() => resumeBill(b.id)}>
                ▶ {m(b.total, symbol)}
              </button>
            ))}
          </div>
        )}
        <select className="input" value={partyId} onChange={(e) => setPartyId(e.target.value)} style={{ marginBottom: ".5rem" }}>
          <option value="">Cash Sale</option>
          {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="scroll-thin" style={{ maxHeight: 340, overflowY: "auto" }}>
          {cartLines.length === 0 ? <p className="text-muted" style={{ fontSize: ".85rem", padding: "1rem 0" }}>Select items to record a sale</p> :
            cartLines.map((c) => (
              <div key={c.item.id} style={{ display: "flex", alignItems: "center", gap: ".4rem", padding: ".35rem 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: ".85rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.item.name}</div>
                  <div className="text-muted" style={{ fontSize: ".75rem" }}>{m(c.item.sales_price, symbol)}</div>
                </div>
                <input className="input" type="number" value={c.qty} onChange={(e) => setQty(c.item.id, Number(e.target.value))} style={{ width: 56, padding: ".25rem" }} />
                <button className="btn btn-danger" style={{ padding: ".15rem .4rem" }} onClick={() => setQty(c.item.id, 0)}>✕</button>
              </div>
            ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "1.15rem", margin: ".75rem 0 .5rem" }}>
          <span>{t("total")}</span><span>{m(total, symbol)}</span>
        </div>
        <div style={{ display: "flex", gap: ".4rem", alignItems: "center", marginBottom: ".4rem" }}>
          <span className="text-muted" style={{ fontSize: ".85rem", minWidth: 70 }}>Received</span>
          <input className="input" type="number" placeholder={String(total)} value={received} onChange={(e) => setReceived(e.target.value === "" ? "" : Number(e.target.value))} />
        </div>
        {change > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".9rem", color: "var(--brand)" }}><span>Change</span><b>{m(change, symbol)}</b></div>}
        {due > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".9rem", color: "var(--red)" }}><span>Due (credit)</span><b>{m(due, symbol)}</b></div>}
        <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)} style={{ margin: ".5rem 0" }}>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={checkout} disabled={busy || cartLines.length === 0}>
          {busy ? "…" : `Checkout · ${m(total, symbol)}`}
        </button>
      </div>
    </div>
  );
}
