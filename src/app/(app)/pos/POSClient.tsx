"use client";
// Quick POS — Karbar layout: item cards on the left, billing cart on the right, "Confirm Sale" dialog to save.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, Modal, Picker, ImageAttach, Switch, post, useToast, type PickOption } from "@/components/ui";
import type { EdAccount, EdItem, EdParty, EdSettings } from "@/lib/editorData";
import { tk, qty as fq, initials, TODAY } from "@/lib/format";

type Line = { id: string; qty: number; rate: number };
type Charge = { title: string; amount: string };
const r2 = (n: number) => Math.round(n * 100) / 100;

export default function POSClient({ items, parties, accounts, settings, nextNo }: {
  items: EdItem[]; parties: EdParty[]; accounts: EdAccount[]; settings: EdSettings; nextNo: number;
}) {
  const router = useRouter();
  const { toast, node: toastNode } = useToast();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [scanOpen, setScanOpen] = useState(false);
  const [scan, setScan] = useState("");
  const scanRef = useRef<HTMLInputElement>(null);
  const [cart, setCart] = useState<Line[]>([]);
  const [editRate, setEditRate] = useState<string | null>(null);
  const [discount, setDiscount] = useState<string | null>(null);
  const [charges, setCharges] = useState<Charge[] | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [counter, setCounter] = useState(nextNo);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const cats = useMemo(() => Array.from(new Set(items.map((i) => i.category).filter(Boolean))) as string[], [items]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((it) => (cat === "all" || it.category === cat) &&
      (!s || it.name.toLowerCase().includes(s) || (it.code || "").toLowerCase().includes(s)));
  }, [items, q, cat]);

  const stockOf = (id: string) => r2(byId.get(id)?.stock || 0); // server refresh after each sale brings fresh stock
  const inCart = (id: string) => cart.find((l) => l.id === id);
  const add = (id: string, by = 1) => setCart((c) => {
    const it = byId.get(id); if (!it) return c;
    const ex = c.find((l) => l.id === id);
    if (ex) return c.map((l) => (l.id === id ? { ...l, qty: r2(Math.max(0, l.qty + by)) } : l)).filter((l) => l.qty > 0);
    return by > 0 ? [...c, { id, qty: by, rate: it.sales_price }] : c;
  });
  const setLine = (id: string, patch: Partial<Line>) => setCart((c) => c.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const remove = (id: string) => setCart((c) => c.filter((l) => l.id !== id));
  const clear = () => { setCart([]); setDiscount(null); setCharges(null); };

  const sub = r2(cart.reduce((a, l) => a + l.qty * l.rate, 0));
  const disc = Math.max(0, Number(discount) || 0);
  const chargeTotal = (charges || []).reduce((a, c) => a + (Number(c.amount) || 0), 0);
  const total = r2(Math.max(0, sub - disc + chargeTotal));

  function addByScan(code: string) {
    const c = code.trim().toLowerCase(); if (!c) return;
    const it = items.find((i) => (i.code || "").toLowerCase() === c) || items.find((i) => i.name.toLowerCase() === c);
    if (!it) { toast(`No item with code “${code}”`); return; }
    add(it.id); toast(`${it.name} added`);
  }

  // Keyboard: "/" focuses search, Enter in search adds the only match.
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <div className="qpos">
      <div className="pos-main">
        <div className="page-head" style={{ marginBottom: ".7rem" }}>
          <div className="page-title">Quick POS</div>
          <div className="row" style={{ gap: ".5rem" }}>
            <div className="search" style={{ width: 280 }}>
              <Icon name="search" size={15} />
              <input ref={searchRef} className="input" placeholder="Search items by name or code" value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && shown.length === 1) { add(shown[0].id); setQ(""); } }} />
            </div>
            <Link href="/inventory/add" className="btn"><Icon name="plus" size={15} />Add New Item</Link>
            <button className={`btn ${scanOpen ? "btn-primary" : ""}`} onClick={() => { setScanOpen((o) => !o); setTimeout(() => scanRef.current?.focus(), 20); }}>
              <Icon name="scan" size={15} />Scan Code
            </button>
          </div>
        </div>
        {scanOpen && (
          <div className="search" style={{ marginBottom: ".7rem" }}>
            <Icon name="barcode" size={15} />
            <input ref={scanRef} className="input" value={scan} placeholder="Scan or type item code, press Enter"
              onChange={(e) => setScan(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addByScan(scan); setScan(""); } else if (e.key === "Escape") setScanOpen(false); }} />
          </div>
        )}
        <div className="pos-cats scroll-thin">
          <button className={`chip ${cat === "all" ? "on" : ""}`} onClick={() => setCat("all")}>All Categories</button>
          {cats.map((c) => <button key={c} className={`chip ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>{c}</button>)}
        </div>
        <div className="pos-grid">
          {shown.map((it) => {
            const l = inCart(it.id);
            const st = stockOf(it.id);
            const unit = (it.unit || "pcs").toUpperCase();
            return (
              <div key={it.id} className={`pos-card ${l ? "on" : ""}`} onClick={() => !l && add(it.id)}>
                <div className="row" style={{ gap: ".55rem", alignItems: "flex-start" }}>
                  <span className="avatar soft pos-av">{initials(it.name)}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="pos-name" title={it.name}>{it.name}</div>
                    <div className={`pos-stock ${st <= 0 && it.type !== "Service" ? "neg" : ""}`}>Qty: {fq(st)} {unit}</div>
                  </div>
                </div>
                <div className="pos-price">{tk(it.sales_price)}<span>/{unit}</span></div>
                {l ? (
                  <div className="pos-step" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => add(it.id, -1)} aria-label="Decrease"><Icon name="minus" size={14} /></button>
                    <input className="input" inputMode="decimal" value={l.qty}
                      onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) setLine(it.id, { qty: v }); }}
                      onBlur={() => { if (!(l.qty > 0)) remove(it.id); }} />
                    <button onClick={() => add(it.id, 1)} aria-label="Increase"><Icon name="plus" size={14} /></button>
                  </div>
                ) : (
                  <div className="pos-select">Click to Select</div>
                )}
              </div>
            );
          })}
          {shown.length === 0 && (
            <div className="empty" style={{ gridColumn: "1 / -1" }}>
              <h3>No items found</h3><div>Try another search or category.</div>
            </div>
          )}
        </div>
      </div>

      <aside className="pos-cart card">
        <div className="pos-cart-head">
          <b>Billing Items ({cart.length})</b>
          {cart.length > 0 && <button className="link" style={{ background: "none", border: 0, cursor: "pointer", color: "var(--red)" }} onClick={clear}>Clear Items</button>}
        </div>
        <div className="pos-lines scroll-thin">
          {cart.length === 0 ? (
            <div className="empty" style={{ padding: "2.5rem 1rem" }}>
              <div className="empty-icon"><Icon name="cart" size={26} /></div>
              <h3>No Billing Items</h3><div>Select items to record a sale</div>
            </div>
          ) : cart.map((l) => {
            const it = byId.get(l.id)!;
            return (
              <div key={l.id} className="pos-line">
                <div className="pos-line-top">
                  <div style={{ minWidth: 0 }}>
                    <div className="pos-name">{it.name}</div>
                    {editRate === l.id ? (
                      <div className="input-group" style={{ width: 130, marginTop: ".25rem" }}><span className="prefix">Tk.</span>
                        <input className="input" autoFocus inputMode="decimal" defaultValue={l.rate}
                          onBlur={(e) => { setLine(l.id, { rate: Math.max(0, Number(e.target.value) || 0) }); setEditRate(null); }}
                          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></div>
                    ) : (
                      <div className="sub">{fq(l.qty)} X {tk(l.rate)}</div>
                    )}
                  </div>
                  <b>{tk(r2(l.qty * l.rate))}</b>
                </div>
                <div className="pos-line-bot">
                  <div className="pos-step sm">
                    <button onClick={() => add(l.id, -1)} aria-label="Decrease"><Icon name="minus" size={13} /></button>
                    <input className="input" inputMode="decimal" value={l.qty}
                      onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) setLine(l.id, { qty: v }); }}
                      onBlur={() => { if (!(l.qty > 0)) remove(l.id); }} />
                    <button onClick={() => add(l.id, 1)} aria-label="Increase"><Icon name="plus" size={13} /></button>
                  </div>
                  <div className="row" style={{ gap: ".15rem" }}>
                    <button className="btn btn-icon btn-sm btn-ghost" title="Edit rate" onClick={() => setEditRate(l.id)}><Icon name="edit" size={14} /></button>
                    <button className="btn btn-icon btn-sm btn-ghost" title="Remove" onClick={() => remove(l.id)}><Icon name="trash" size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="pos-foot">
          <div className="between"><span>Sub Total</span><b>{tk(sub)}</b></div>
          {discount !== null && (
            <div className="between"><span>Discount</span>
              <div className="row" style={{ gap: ".2rem" }}>
                <div className="input-group" style={{ width: 120 }}><span className="prefix">Tk.</span>
                  <input className="input" autoFocus inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
                <button className="btn btn-icon btn-sm btn-ghost" onClick={() => setDiscount(null)}><Icon name="x" size={13} /></button>
              </div>
            </div>
          )}
          {(charges || []).map((c, i) => (
            <div key={i} className="pos-charge">
              <input className="input" list="pos-charge-presets" placeholder="Charge name" value={c.title}
                onChange={(e) => setCharges((cs) => (cs || []).map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
              <div className="input-group"><span className="prefix">Tk.</span>
                <input className="input" inputMode="decimal" value={c.amount} placeholder="0"
                  onChange={(e) => setCharges((cs) => (cs || []).map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} /></div>
              <button className="btn btn-icon btn-sm btn-ghost" onClick={() => setCharges((cs) => { const n = (cs || []).filter((_, j) => j !== i); return n.length ? n : null; })}><Icon name="x" size={13} /></button>
            </div>
          ))}
          <datalist id="pos-charge-presets">{settings.charge_presets.map((p) => <option key={p} value={p} />)}</datalist>
          <div className="row pos-adds">
            {discount === null && <button className="link" onClick={() => setDiscount("")}><Icon name="plus" size={12} />Discount</button>}
            {settings.additional_charges_enabled !== false && (
              <button className="link" onClick={() => setCharges((cs) => [...(cs || []), { title: settings.charge_presets[(cs || []).length] || "", amount: "" }])}>
                <Icon name="plus" size={12} />Additional Charges
              </button>
            )}
          </div>
          <div className="between pos-total"><span>Total Amount</span><b>{tk(total)}</b></div>
          <button className="btn btn-primary btn-lg" style={{ width: "100%", justifyContent: "center" }} disabled={cart.length === 0}
            onClick={() => setConfirm(true)}>Continue Billing</button>
        </div>
      </aside>

      {confirm && (
        <ConfirmSale
          number={counter} total={total} parties={parties} accounts={accounts} settings={settings}
          onClose={() => setConfirm(false)}
          onSave={async (f, print) => {
            const lines = cart.map((l) => {
              const it = byId.get(l.id)!;
              return { itemId: it.id, name: it.name, qty: l.qty, rate: l.rate, discountType: "flat", discountValue: 0, taxRate: 0, unit: it.unit };
            });
            const { ok, data } = await post<{ id: string; number: number }>("/api/documents", {
              op: "create", kind: "sales_invoice", party_id: f.partyId, date: f.date, number: f.manual ? f.number : undefined,
              notes: f.notes || null, images: f.images, lines,
              charges: (charges || []).filter((c) => c.title.trim() && Number(c.amount)).map((c) => ({ title: c.title.trim(), amount: Number(c.amount) })),
              doc_discount: disc, paid_amount: f.received, account_id: f.accountId,
            });
            if (!ok) return data.error || "Could not save the sale.";
            if (print) { router.push(`/doc/${data.id}?print=1${settings.print_type === "thermal" ? "&thermal=1" : ""}`); return null; }
            setCounter((data.number || counter) + 1);
            clear(); setConfirm(false);
            toast(`Sales Invoice #${data.number} saved`);
            router.refresh();
            return null;
          }}
        />
      )}
      {toastNode}
    </div>
  );
}

type SaleForm = { number: number; manual: boolean; date: string; partyId: string | null; received: number; accountId: string | null; notes: string; images: string[] };

function ConfirmSale({ number, total, parties, accounts, settings, onClose, onSave }: {
  number: number; total: number; parties: EdParty[]; accounts: EdAccount[]; settings: EdSettings;
  onClose: () => void; onSave: (f: SaleForm, print: boolean) => Promise<string | null>;
}) {
  const [manual, setManual] = useState(false);
  const [no, setNo] = useState(String(number));
  const [date, setDate] = useState(TODAY());
  const [partyId, setPartyId] = useState<string | null>(null);
  const [fully, setFully] = useState(true);
  const [received, setReceived] = useState(String(total));
  const cash = accounts.find((a) => /cash/i.test(a.name)) || accounts[0];
  const [accountId, setAccountId] = useState<string | null>(cash?.id || null);
  const [notes, setNotes] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const isCash = !partyId;
  const effFully = isCash || fully;
  const rec = effFully ? total : Math.max(0, Math.min(total, Number(received) || 0));

  const opts: PickOption[] = [
    { id: "__cash", label: "Cash Sale", sub: "Walk-in customer" },
    ...parties.map((p) => ({
      id: p.id, label: p.name, sub: p.phone || undefined,
      right: p.balance ? tk(Math.abs(p.balance)) : undefined, rightTone: p.balance > 0 ? "pos" as const : p.balance < 0 ? "neg" as const : undefined,
    })),
  ];

  async function save(print: boolean) {
    if (manual && !(Number(no) > 0)) { setErr("Enter a valid invoice number."); return; }
    setBusy(true); setErr("");
    const e = await onSave({ number: Number(no), manual, date, partyId, received: rec, accountId, notes, images }, print);
    setBusy(false);
    if (e) setErr(e);
  }

  return (
    <Modal title="Confirm Sale" onClose={() => !busy && onClose()} width={520} footer={
      <>
        <button className="btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn" onClick={() => save(false)} disabled={busy}>Save Only</button>
        <button className="btn btn-primary" onClick={() => save(true)} disabled={busy}><Icon name="printer" size={15} />{busy ? "Saving…" : "Save & Print"}</button>
      </>
    }>
      <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="field">
          <label className="label between"><span>Invoice No</span>
            <button type="button" className="link" style={{ background: "none", border: 0, cursor: "pointer", fontSize: 12 }}
              onClick={() => { setManual((m) => !m); setNo(String(number)); }}>{manual ? "Auto" : "Manual"}</button>
          </label>
          <div className="input-group">
            {settings.prefix && <span className="prefix">{settings.prefix}</span>}
            <input className="input" value={manual ? no : String(number)} disabled={!manual} inputMode="numeric"
              onChange={(e) => setNo(e.target.value.replace(/[^\d]/g, ""))} style={settings.prefix ? undefined : { paddingLeft: ".7rem" }} />
          </div>
        </div>
        <div className="field">
          <label className="label">Invoice Date</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label className="label">Bill To</label>
        <Picker value={partyId || "__cash"} options={opts} placeholder="Cash Sale"
          onChange={(id) => { const v = id && id !== "__cash" ? id : null; setPartyId(v); if (!v) setFully(true); }} />
      </div>
      <div className="between pos-confirm-total"><span>Total Amount</span><b>{tk(total)}</b></div>
      <div className="field">
        <div className="label between">
          <span className="row" style={{ gap: ".45rem" }}>
            <Switch on={effFully} disabled={isCash} onChange={(v) => { setFully(v); if (!v) setReceived(""); }} />Received Amount
          </span>
          {!effFully && <span className="sub">Due {tk(r2(total - rec))}</span>}
        </div>
        <div className="input-group"><span className="prefix">Tk.</span>
          <input className="input" inputMode="decimal" value={effFully ? String(total) : received} disabled={effFully} placeholder="0"
            onChange={(e) => setReceived(e.target.value)} /></div>
        {isCash && <div className="sub">Cash Sale is always fully received. Choose a party to keep a due.</div>}
      </div>
      <div className="field">
        <label className="label">Payment Method</label>
        <select className="input" value={accountId || ""} onChange={(e) => setAccountId(e.target.value || null)}>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label className="label">Notes</label>
        <textarea className="input" rows={2} value={notes} placeholder="Enter notes" onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="field">
        <label className="label">Attach Images</label>
        <ImageAttach images={images} onChange={setImages} />
      </div>
      {err && <div className="neg" style={{ fontSize: 12.5 }}>{err}</div>}
    </Modal>
  );
}
