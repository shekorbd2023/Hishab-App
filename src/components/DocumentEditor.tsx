"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/Providers";
import { api } from "@/lib/clientUtil";

type Item = { id: string; name: string; sales_price: number; purchase_price: number; wholesale_price: number; code: string | null };
type Party = { id: string; name: string; type: string };
type Account = { id: string; name: string };
type Line = { itemId: string | null; name: string; qty: number; rate: number; discountType: "flat" | "percent"; discountValue: number; taxRate: number };

const KIND_TITLE: Record<string, string> = {
  sales_invoice: "Create Sales Invoice", purchase_bill: "Create Purchase Bill",
  quotation: "Create Quotation", sales_return: "Create Sales Return", purchase_return: "Create Purchase Return",
};

function lineAmt(l: Line) {
  const base = l.qty * l.rate;
  const disc = l.discountType === "percent" ? (base * l.discountValue) / 100 : l.discountValue;
  const after = Math.max(0, base - disc);
  return after + (after * l.taxRate) / 100;
}
const m = (n: number, s: string) => `${s} ${(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export default function DocumentEditor({
  kind, parties, items, accounts, nextNumber, symbol,
}: {
  kind: string; parties: Party[]; items: Item[]; accounts: Account[]; nextNumber: number; symbol: string;
}) {
  const { t } = useT();
  const router = useRouter();
  const isPurchase = kind === "purchase_bill" || kind === "purchase_return";
  const [partyId, setPartyId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [paidFull, setPaidFull] = useState(kind === "sales_invoice");
  const [lines, setLines] = useState<Line[]>([{ itemId: null, name: "", qty: 1, rate: 0, discountType: "flat", discountValue: 0, taxRate: 0 }]);
  const [busy, setBusy] = useState(false);

  const totals = useMemo(() => {
    let subtotal = 0, discount = 0, tax = 0;
    for (const l of lines) {
      const base = l.qty * l.rate;
      const d = l.discountType === "percent" ? (base * l.discountValue) / 100 : l.discountValue;
      const after = Math.max(0, base - d);
      subtotal += base; discount += d; tax += (after * l.taxRate) / 100;
    }
    return { subtotal, discount, tax, total: subtotal - discount + tax };
  }, [lines]);

  function setLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function pickItem(i: number, name: string) {
    const it = items.find((x) => x.name === name || x.code === name);
    if (it) setLine(i, { itemId: it.id, name: it.name, rate: isPurchase ? it.purchase_price : it.sales_price });
    else setLine(i, { itemId: null, name });
  }
  const addLine = () => setLines((ls) => [...ls, { itemId: null, name: "", qty: 1, rate: 0, discountType: "flat", discountValue: 0, taxRate: 0 }]);
  const delLine = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i));

  async function save() {
    setBusy(true);
    const paid = kind === "quotation" ? 0 : paidFull ? totals.total : 0;
    const { ok, data } = await api("/api/documents", {
      op: "create", kind, party_id: partyId || null, date, notes, payment_mode: paymentMode,
      account_id: accountId || null, paid_amount: paid, lines,
    });
    setBusy(false);
    if (ok) router.push(`/doc/${data.id}`);
    else alert((data.error as string) || "Failed");
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "1rem" }}>{KIND_TITLE[kind]}</h1>
      <div className="card" style={{ padding: "1.25rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: ".75rem", marginBottom: "1rem" }}>
          <div>
            <label className="label">{isPurchase ? t("supplier") : t("customer")}</label>
            <select className="input" value={partyId} onChange={(e) => setPartyId(e.target.value)}>
              <option value="">{isPurchase ? "— select —" : "Cash Sale"}</option>
              {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div><label className="label">No.</label><input className="input" value={nextNumber} disabled /></div>
          <div><label className="label">{t("date")}</label><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>

        <datalist id="itemlist">{items.map((it) => <option key={it.id} value={it.name} />)}</datalist>
        <div style={{ overflowX: "auto" }} className="scroll-thin">
          <table className="tbl">
            <thead><tr>
              <th style={{ minWidth: 200 }}>{t("name")}</th><th>{t("quantity")}</th><th>{t("rate")}</th>
              <th>{t("discount")}</th><th>Tax %</th><th style={{ textAlign: "right" }}>{t("amount")}</th><th></th>
            </tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td><input className="input" list="itemlist" value={l.name} placeholder="Item name" onChange={(e) => pickItem(i, e.target.value)} /></td>
                  <td><input className="input" style={{ width: 70 }} type="number" value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} /></td>
                  <td><input className="input" style={{ width: 90 }} type="number" value={l.rate} onChange={(e) => setLine(i, { rate: Number(e.target.value) })} /></td>
                  <td style={{ display: "flex", gap: 2 }}>
                    <input className="input" style={{ width: 60 }} type="number" value={l.discountValue} onChange={(e) => setLine(i, { discountValue: Number(e.target.value) })} />
                    <select className="input" style={{ width: 56 }} value={l.discountType} onChange={(e) => setLine(i, { discountType: e.target.value as "flat" | "percent" })}>
                      <option value="flat">Tk</option><option value="percent">%</option>
                    </select>
                  </td>
                  <td><input className="input" style={{ width: 60 }} type="number" value={l.taxRate} onChange={(e) => setLine(i, { taxRate: Number(e.target.value) })} /></td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{m(lineAmt(l), symbol)}</td>
                  <td><button className="btn btn-danger" style={{ padding: ".2rem .45rem" }} onClick={() => delLine(i)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn" style={{ marginTop: ".6rem" }} onClick={addLine}>+ Add Item</button>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "1rem", marginTop: "1.25rem" }}>
          <div>
            <label className="label">{t("note")}</label>
            <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div style={{ display: "grid", gap: ".4rem" }}>
            <Row label={t("subtotal")} val={m(totals.subtotal, symbol)} />
            <Row label={t("discount")} val={"− " + m(totals.discount, symbol)} />
            <Row label={t("tax")} val={m(totals.tax, symbol)} />
            <Row label={t("total")} val={m(totals.total, symbol)} bold />
            {kind !== "quotation" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".4rem", marginTop: ".4rem" }}>
                  <div><label className="label">{t("payment_mode")}</label>
                    <select className="input" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                      <option>Cash</option><option>Bank</option><option>Bkash</option><option>Nagad</option><option>Credit</option>
                    </select>
                  </div>
                  <div><label className="label">Account</label>
                    <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                </div>
                <label style={{ display: "flex", gap: ".5rem", alignItems: "center", fontSize: ".85rem", marginTop: ".3rem" }}>
                  <input type="checkbox" checked={paidFull} onChange={(e) => setPaidFull(e.target.checked)} />
                  Mark as fully paid now
                </label>
              </>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: ".5rem", marginTop: "1.25rem" }}>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "…" : t("save")}</button>
          <button className="btn" onClick={() => router.back()}>{t("cancel")}</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, val, bold }: { label: string; val: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: bold ? 800 : 400, fontSize: bold ? "1.05rem" : ".9rem", paddingTop: bold ? ".3rem" : 0, borderTop: bold ? "1px solid var(--border)" : "none" }}>
      <span className={bold ? "" : "text-muted"}>{label}</span><span>{val}</span>
    </div>
  );
}
