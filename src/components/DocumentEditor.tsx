"use client";
// Karbar-style create / edit form for all 5 transaction kinds.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, Picker, Modal, Seg, Switch, ImageAttach, SplitButton, BackButton, post, useToast, type PickOption } from "@/components/ui";
import { tk, qty as fmtQty, TODAY } from "@/lib/format";
import { KIND, totals, num, r2, type DocKind, type Line } from "@/app/(app)/documents/kinds";
import type { EdParty, EdItem, EdAccount, EdSettings, EditDoc } from "@/lib/editorData";

type ELine = { key: string; itemId: string | null; name: string; qty: string; rate: string; discMode: "percent" | "flat"; discPct: string; discTk: string; unit: string | null };
type ECharge = { key: string; title: string; amount: string };

const CASH = "__cash";
let seq = 0;
const k = () => `k${++seq}`;
const s2 = (n: number) => (Number.isFinite(n) && n !== 0 ? String(r2(n)) : "");
const emptyLine = (): ELine => ({ key: k(), itemId: null, name: "", qty: "", rate: "", discMode: "percent", discPct: "", discTk: "", unit: null });
const toLine = (l: ELine): Line => ({
  itemId: l.itemId, name: l.name.trim(), qty: num(l.qty), rate: num(l.rate), unit: l.unit,
  discountType: l.discMode, discountValue: l.discMode === "percent" ? num(l.discPct) : num(l.discTk),
});
const withTrailing = (ls: ELine[]) => (ls.length === 0 || ls[ls.length - 1].name.trim() ? [...ls, emptyLine()] : ls);

export default function DocumentEditor({
  kind, parties, items, accounts, settings, nextNumber, doc, initialPartyId,
}: {
  kind: DocKind; parties: EdParty[]; items: EdItem[]; accounts: EdAccount[]; settings: EdSettings; nextNumber: number;
  doc?: EditDoc; initialPartyId?: string | null;
}) {
  const meta = KIND[kind];
  const router = useRouter();
  const { toast, node: toastNode } = useToast();
  const rootRef = useRef<HTMLDivElement>(null);
  const isEdit = !!doc;
  const isQuote = kind === "quotation";
  const allowCash = kind === "sales_invoice" || kind === "quotation";
  const salesSide = meta.partyType === "customer";

  const [added, setAdded] = useState<EdParty[]>([]);
  const allParties = useMemo(() => [...parties, ...added.filter((a) => !parties.some((p) => p.id === a.id))], [parties, added]);

  const defaultParty = doc ? doc.party_id || (allowCash ? CASH : null) : initialPartyId || (allowCash && settings.cash_sale_default ? CASH : null);
  const [partyId, setPartyId] = useState<string | null>(defaultParty);
  const [autoNo, setAutoNo] = useState(nextNumber);
  const [manualNo, setManualNo] = useState(isEdit);
  const [number, setNumber] = useState(String(nextNumber));
  const [date, setDate] = useState(doc?.date || TODAY());
  const [lines, setLines] = useState<ELine[]>(() => withTrailing((doc?.lines || []).map((l) => ({
    key: k(), itemId: l.itemId, name: l.name, qty: String(l.qty), rate: String(l.rate), unit: l.unit,
    discMode: l.discountType, discPct: l.discountType === "percent" ? s2(l.discountValue) : "", discTk: l.discountType === "flat" ? s2(l.discountValue) : "",
  }))));
  const [charges, setCharges] = useState<ECharge[]>(() => (doc?.charges || []).map((c) => ({ key: k(), title: c.title, amount: String(c.amount) })));
  const [docDiscount, setDocDiscount] = useState(doc?.doc_discount ? String(doc.doc_discount) : "");
  const [roundOn, setRoundOn] = useState(doc ? !!doc.round_off : settings.round_off_enabled);
  const [notes, setNotes] = useState(doc?.notes || "");
  const [images, setImages] = useState<string[]>(doc?.images || []);
  const [dueDate, setDueDate] = useState(doc?.due_date || "");
  const cashAcc = accounts.find((a) => a.name.toLowerCase() === "cash") || accounts.find((a) => a.type === "cash") || accounts[0];
  const [accountId, setAccountId] = useState(doc?.account_id || cashAcc?.id || "");
  const [received, setReceived] = useState(doc ? String(doc.received || "") : "");
  const [fully, setFully] = useState<boolean>(() => (doc ? false : !defaultParty || defaultParty === CASH));
  const [fullyTouched, setFullyTouched] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scan, setScan] = useState("");
  const [addParty, setAddParty] = useState<string | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const isCash = !partyId || partyId === CASH;
  const party = isCash ? null : allParties.find((p) => p.id === partyId) || null;

  /* ---------- money ---------- */
  const filled = useMemo(() => lines.filter((l) => l.name.trim()), [lines]);
  const cleanCharges = useMemo(() => charges.map((c) => ({ title: c.title.trim(), amount: num(c.amount) })).filter((c) => c.title && c.amount), [charges]);
  const pre = useMemo(() => totals(filled.map(toLine), num(docDiscount), cleanCharges, 0), [filled, docDiscount, cleanCharges]);
  const roundOff = roundOn ? r2(Math.round(pre.beforeRound) - pre.beforeRound) : 0;
  const total = r2(pre.beforeRound + roundOff);
  const forcedFull = isCash && !isQuote;
  const effFully = forcedFull || fully;
  const paid = isQuote ? 0 : effFully ? total : num(received);
  const due = r2(total - paid);

  // edit mode: tick "Fully received" when the stored payment covers the total
  useEffect(() => {
    if (doc && !fullyTouched) setFully(doc.received > 0 && doc.received >= total - 0.005);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- stock ---------- */
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const origQty = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of doc?.lines || []) if (l.itemId) m.set(l.itemId, (m.get(l.itemId) || 0) + l.qty);
    return m;
  }, [doc]);
  const stockWarn = useMemo(() => {
    const w = new Map<string, { level: "low" | "out"; text: string }>();
    if (meta.stockSign !== -1) return w;
    const need = new Map<string, number>();
    for (const l of filled) if (l.itemId) need.set(l.itemId, (need.get(l.itemId) || 0) + num(l.qty));
    for (const [id, q] of need) {
      const it = itemMap.get(id);
      if (!it || it.type === "Service") continue;
      const avail = it.stock + (origQty.get(id) || 0);
      const after = avail - q;
      const u = (it.unit || "").toUpperCase();
      if (after < 0) w.set(id, { level: "out", text: avail <= 0 ? `Out of stock (${fmtQty(avail)} ${u})` : `Only ${fmtQty(avail)} ${u} in stock` });
      else if (settings.low_stock_dialog && it.low_stock_alert > 0 && after <= it.low_stock_alert) w.set(id, { level: "low", text: `Low stock: ${fmtQty(after)} ${u} left after this` });
    }
    return w;
  }, [filled, itemMap, origQty, meta.stockSign, settings.low_stock_dialog]);

  /* ---------- pickers ---------- */
  const partyOpts = useMemo<PickOption[]>(() => {
    const o: PickOption[] = allParties.map((p) => ({
      id: p.id, label: p.name, sub: p.phone || (p.type === "supplier" ? "Supplier" : "Customer"),
      right: tk(Math.abs(p.balance)), rightTone: p.balance > 0.004 ? "pos" : p.balance < -0.004 ? "neg" : undefined,
    }));
    if (allowCash) o.unshift({ id: CASH, label: meta.cashLabel, sub: "Walk-in customer" });
    return o;
  }, [allParties, allowCash, meta.cashLabel]);
  const itemOpts = useMemo<PickOption[]>(() => items.map((it) => ({
    id: it.id, label: it.name,
    sub: `${it.type === "Service" ? "Service" : `Stock: ${fmtQty(it.stock)} ${(it.unit || "").toUpperCase()}`}${it.code ? ` · ${it.code}` : ""}`,
    right: tk(it[meta.priceField]), rightTone: it.stock <= 0 && it.type !== "Service" && meta.stockSign === -1 ? "neg" : undefined,
  })), [items, meta.priceField, meta.stockSign]);
  const chargeOpts = useMemo<PickOption[]>(() => settings.charge_presets.map((c) => ({ id: c, label: c })), [settings.charge_presets]);

  function choosePartyId(id: string | null) {
    setPartyId(id);
    setErrors([]);
    if (!fullyTouched && !isEdit) setFully(!id || id === CASH);
  }

  /* ---------- lines ---------- */
  const setLine = (key: string, patch: Partial<ELine>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const focusSel = (sel: string) => setTimeout(() => { const el = rootRef.current?.querySelector<HTMLInputElement>(sel); el?.focus(); el?.select?.(); }, 30);

  function pickItem(key: string, id: string | null) {
    if (!id) { setLine(key, { itemId: null }); return; }
    const it = itemMap.get(id);
    if (!it) return;
    setLines((ls) => withTrailing(ls.map((l) => (l.key === key ? { ...l, itemId: it.id, name: it.name, rate: String(it[meta.priceField] || 0), unit: it.unit || null, qty: l.qty && num(l.qty) > 0 ? l.qty : "1" } : l))));
    focusSel(`[data-qty="${key}"]`);
  }
  function freeName(key: string, text: string) {
    setLines((ls) => {
      const next = ls.map((l) => (l.key === key ? { ...l, name: text, itemId: null, qty: text && !l.qty ? "1" : l.qty } : l));
      return text.trim() ? withTrailing(next) : next;
    });
  }
  function removeLine(key: string) {
    setLines((ls) => withTrailing(ls.filter((l) => l.key !== key)));
  }
  function addByScan(code: string) {
    const s = code.trim().toLowerCase();
    if (!s) return;
    const it = items.find((i) => (i.code || "").toLowerCase() === s) || items.find((i) => i.name.toLowerCase() === s);
    if (!it) { toast(`No item with code “${code}”`); return; }
    setLines((ls) => {
      const ex = ls.find((l) => l.itemId === it.id);
      if (ex) return ls.map((l) => (l === ex ? { ...l, qty: String(num(l.qty) + 1) } : l));
      const blank = ls.findIndex((l) => !l.name.trim());
      const nl: ELine = { ...emptyLine(), itemId: it.id, name: it.name, qty: "1", rate: String(it[meta.priceField] || 0), unit: it.unit || null };
      const next = blank >= 0 ? ls.map((l, i) => (i === blank ? { ...nl, key: l.key } : l)) : [...ls, nl];
      return withTrailing(next);
    });
    toast(`Added ${it.name}`);
  }

  /* ---------- save ---------- */
  function validate(): string[] {
    const e: string[] = [];
    if (!allowCash && !party) e.push("Select a party.");
    if (filled.length === 0) e.push("Add at least one billing item.");
    for (const [i, l] of filled.entries()) {
      if (num(l.qty) <= 0) e.push(`Row ${i + 1}: quantity must be more than 0.`);
      if (num(l.rate) < 0) e.push(`Row ${i + 1}: rate cannot be negative.`);
    }
    if (manualNo && !(num(number) > 0)) e.push(`${meta.noLabel} must be a number.`);
    if (!date) e.push("Pick a date.");
    if (!isQuote && paid > total + 0.005) e.push(`${meta.payLabel} cannot be more than the total.`);
    if (!isQuote && paid < 0) e.push(`${meta.payLabel} cannot be negative.`);
    if (!isQuote && paid > 0 && !accountId) e.push("Choose a payment mode.");
    if (total < 0) e.push("Total cannot be negative — check the discount.");
    if (settings.prevent_out_of_stock && [...stockWarn.values()].some((w) => w.level === "out")) e.push("Some items are out of stock (Prevent Out-of-Stock Sale is on).");
    return e;
  }

  const save = useCallback(async (mode: "save" | "print" | "new") => {
    if (busy) return;
    const e = validate();
    setErrors(e);
    if (e.length) return;
    setBusy(true);
    const body = {
      op: isEdit ? "update" : "create", id: doc?.id, kind,
      party_id: party ? party.id : null, date, number: manualNo ? Math.floor(num(number)) : undefined,
      notes: notes.trim() || null, images, lines: filled.map(toLine), charges: cleanCharges,
      doc_discount: num(docDiscount), round_off: roundOff, due_date: settings.due_date_reminder || doc?.due_date ? dueDate || null : null,
      paid_amount: paid, account_id: isQuote ? null : accountId || null,
    };
    const { ok, data } = await post<{ id: string; number: number }>("/api/documents", body);
    setBusy(false);
    if (!ok) { setErrors([data.error || "Could not save. Please try again."]); return; }
    if (mode === "print") { router.push(`/doc/${data.id}?print=1${settings.print_type === "thermal" ? "&thermal=1" : ""}`); return; }
    if (mode === "save") { router.push(`/doc/${data.id}`); return; }
    // Save & New
    if (isEdit) { router.push(`/documents/new?kind=${kind}`); return; }
    toast(`${meta.single} #${settings.prefix}${data.number} saved`);
    const nn = Math.max(autoNo, data.number) + 1;
    setAutoNo(nn); setNumber(String(nn)); setManualNo(false);
    setLines([emptyLine()]); setCharges([]); setDocDiscount(""); setNotes(""); setImages([]); setDueDate(""); setReceived("");
    const p0 = allowCash && settings.cash_sale_default ? CASH : null;
    setPartyId(p0); setFully(!p0 || p0 === CASH); setFullyTouched(false); setErrors([]);
    router.refresh();
    focusSel(".de-party input");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, isEdit, doc, kind, party, date, manualNo, number, notes, images, filled, cleanCharges, docDiscount, roundOff, dueDate, paid, accountId, settings, autoNo, meta.single, allowCash]);

  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveRef.current("save"); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  /** Enter → next field (Pickers handle their own Enter). */
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter" || e.defaultPrevented || e.shiftKey) return;
    const t = e.target as HTMLElement;
    if (t.tagName !== "INPUT" && t.tagName !== "SELECT") return;
    if (t.getAttribute("data-scan") !== null) return;
    const type = (t as HTMLInputElement).type;
    if (type === "checkbox" || type === "file") return;
    e.preventDefault();
    const els = Array.from(rootRef.current?.querySelectorAll<HTMLElement>(
      "input:not([disabled]):not([type=checkbox]):not([type=file]):not([type=hidden]), select:not([disabled]), textarea:not([disabled])"
    ) || []).filter((el) => el.offsetParent !== null);
    const i = els.indexOf(t);
    const nx = els[i + 1];
    if (nx) { nx.focus(); (nx as HTMLInputElement).select?.(); }
  }

  const title = isEdit ? `Edit ${meta.single} #${settings.prefix}${doc!.number}` : meta.create;
  const saveLabel = isEdit ? "Update" : `Save ${meta.single}`;
  const showCharges = settings.additional_charges_enabled || charges.length > 0;
  const showRound = settings.round_off_enabled || (doc?.round_off ?? 0) !== 0;
  const showDue = !isQuote && (settings.due_date_reminder || !!doc?.due_date);

  return (
    <div className="de" ref={rootRef} onKeyDown={onKeyDown}>
      <div className="page-head">
        <div className="page-title">
          <BackButton href={isEdit ? `/doc/${doc!.id}` : meta.path} />
          {title}
          <Link href="/settings/features/transactions" className="btn btn-icon btn-sm btn-ghost" title="Transaction settings" aria-label="Transaction settings"><Icon name="settings" size={16} /></Link>
        </div>
        <div className="row sub" style={{ gap: ".75rem" }}>
          <span><span className="kbd">Enter</span> next field</span>
          <span><span className="kbd">Ctrl</span>+<span className="kbd">S</span> save</span>
        </div>
      </div>

      {/* ---------- Card 1: party / number / date ---------- */}
      <div className="card de-card de-head">
        <div className="field de-party">
          <label className="label">{salesSide ? "Select Party" : "Select Party (Supplier)"}{!allowCash && <span className="req"> *</span>}</label>
          <Picker
            value={partyId} options={partyOpts} onChange={(id) => choosePartyId(id)}
            placeholder={allowCash ? meta.cashLabel : "Search party by name or phone"}
            onCreate={(t) => setAddParty(t)} createLabel="Add new party" clearable={!allowCash || partyId !== CASH} autoFocus={!isEdit}
          />
          {party && (
            <div className="sub de-bal">
              Balance: <b className={party.balance > 0 ? "pos" : party.balance < 0 ? "neg" : ""}>{tk(Math.abs(party.balance))}</b>
              {party.balance > 0 ? " To Receive" : party.balance < 0 ? " To Give" : " Settled"}
              {party.phone ? ` · ${party.phone}` : ""}
            </div>
          )}
        </div>
        <div className="field">
          <label className="label between">
            <span>{meta.noLabel}</span>
            {!isEdit && (
              <button type="button" className="link de-manual" onClick={() => { setManualNo((m) => !m); setNumber(String(autoNo)); if (!manualNo) focusSel("[data-no]"); }}>
                {manualNo ? "Auto" : "Manual"}
              </button>
            )}
          </label>
          <div className="input-group">
            {settings.prefix && <span className="prefix">{settings.prefix}</span>}
            <input data-no className="input" inputMode="numeric" value={manualNo ? number : String(autoNo)} disabled={!manualNo}
              onChange={(e) => setNumber(e.target.value.replace(/[^\d]/g, ""))} style={settings.prefix ? undefined : { paddingLeft: ".7rem" }} />
          </div>
        </div>
        <div className="field">
          <label className="label">{meta.single === "Quotation" ? "Quotation" : meta.noLabel.replace(" No", "")} Date</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {/* ---------- Card 2: items ---------- */}
      <div className="card de-card de-items">
        <div className="de-tablewrap scroll-thin">
          <table className="tbl de-tbl">
            <thead>
              <tr>
                <th style={{ width: 44 }}>S.N.</th>
                <th>Name</th>
                <th style={{ width: 130 }}>Quantity</th>
                <th style={{ width: 120 }}>Rate (Tk.)</th>
                <th style={{ width: 190 }}>Discount</th>
                <th className="num" style={{ width: 120 }}>Amount</th>
                <th style={{ width: 44 }} />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const L = toLine(l);
                const base = L.qty * L.rate;
                const pctVal = l.discMode === "percent" ? l.discPct : base > 0 && num(l.discTk) ? s2((num(l.discTk) / base) * 100) : "";
                const tkVal = l.discMode === "flat" ? l.discTk : num(l.discPct) ? s2((base * num(l.discPct)) / 100) : "";
                const warn = l.itemId ? stockWarn.get(l.itemId) : undefined;
                const isLast = i === lines.length - 1 && !l.name.trim();
                const amount = L.qty > 0 ? Math.max(0, base - (L.discountType === "percent" ? (base * (L.discountValue || 0)) / 100 : L.discountValue || 0)) : 0;
                return (
                  <tr key={l.key} className={isLast ? "de-ghost" : ""}>
                    <td className="text-muted">{i + 1}</td>
                    <td>
                      <div data-name={l.key}>
                        <Picker
                          value={l.itemId} options={itemOpts} onChange={(id) => pickItem(l.key, id)}
                          placeholder="Enter Item name" allowFree freeText={l.name} onFreeText={(t) => freeName(l.key, t)}
                        />
                      </div>
                      {warn && <div className={`de-warn ${warn.level}`}><Icon name="info" size={12} />{warn.text}</div>}
                    </td>
                    <td>
                      <div className="de-sfx">
                        <input data-qty={l.key} className="input" inputMode="decimal" value={l.qty} placeholder="0"
                          onChange={(e) => setLine(l.key, { qty: e.target.value })} />
                        {l.unit && <span>{l.unit.toUpperCase()}</span>}
                      </div>
                    </td>
                    <td><input className="input" inputMode="decimal" value={l.rate} placeholder="0" onChange={(e) => setLine(l.key, { rate: e.target.value })} /></td>
                    <td>
                      <div className="de-disc">
                        <div className="de-sfx"><input className="input" inputMode="decimal" value={pctVal} placeholder="0"
                          onChange={(e) => setLine(l.key, { discMode: "percent", discPct: e.target.value, discTk: "" })} /><span>%</span></div>
                        <div className="de-sfx"><input className="input" inputMode="decimal" value={tkVal} placeholder="0"
                          onChange={(e) => setLine(l.key, { discMode: "flat", discTk: e.target.value, discPct: "" })} /><span>Tk.</span></div>
                      </div>
                    </td>
                    <td className="num" style={{ fontWeight: 600 }}>{tk(r2(amount))}</td>
                    <td>
                      {!isLast && (
                        <button type="button" className="btn btn-icon btn-sm btn-ghost de-del" onClick={() => removeLine(l.key)} title="Remove Item" aria-label="Remove Item">
                          <Icon name="trash" size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="de-under">
          <div className="de-actions">
            <button type="button" className="btn btn-soft" onClick={() => { setLines((ls) => [...ls, emptyLine()]); focusSel(".de-tbl tbody tr:last-child [data-name] input"); }}>
              <Icon name="plus" size={15} />Add Billing Item
            </button>
            <button type="button" className={`btn ${scanOpen ? "btn-primary" : ""}`} onClick={() => { setScanOpen((o) => !o); setTimeout(() => scanRef.current?.focus(), 20); }}>
              <Icon name="scan" size={15} />Scan Code
            </button>
            {scanOpen && (
              <div className="search de-scan">
                <Icon name="barcode" size={15} />
                <input ref={scanRef} data-scan className="input" value={scan} placeholder="Scan or type item code, press Enter"
                  onChange={(e) => setScan(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addByScan(scan); setScan(""); } else if (e.key === "Escape") setScanOpen(false); }} />
              </div>
            )}
          </div>

          <div className="de-sum">
            <div className="de-sumrow"><span>Sub Total</span><b>{tk(pre.billing)}</b></div>
            {pre.lineDiscount > 0 && <div className="de-sumrow sub"><span>Item discounts included</span><span>− {tk(pre.lineDiscount)}</span></div>}
            {showCharges && charges.map((c) => (
              <div key={c.key} className="de-charge">
                <Picker value={chargeOpts.some((o) => o.id === c.title) ? c.title : null} options={chargeOpts}
                  onChange={(id) => id && setCharges((cs) => cs.map((x) => (x.key === c.key ? { ...x, title: id } : x)))}
                  placeholder="Charge name" allowFree freeText={c.title}
                  onFreeText={(t) => setCharges((cs) => cs.map((x) => (x.key === c.key ? { ...x, title: t } : x)))} />
                <div className="input-group de-amt"><span className="prefix">Tk.</span>
                  <input className="input" inputMode="decimal" value={c.amount} placeholder="0"
                    onChange={(e) => setCharges((cs) => cs.map((x) => (x.key === c.key ? { ...x, amount: e.target.value } : x)))} /></div>
                <button type="button" className="btn btn-icon btn-sm btn-ghost de-del" onClick={() => setCharges((cs) => cs.filter((x) => x.key !== c.key))} aria-label="Remove charge"><Icon name="x" size={14} /></button>
              </div>
            ))}
            {showCharges && (
              <button type="button" className="link de-addcharge" onClick={() => { setCharges((cs) => [...cs, { key: k(), title: "", amount: "" }]); focusSel(".de-charge:last-of-type input"); }}>
                <Icon name="plus" size={13} />Additional Charges
              </button>
            )}
            <div className="de-sumrow">
              <span>Discount</span>
              <div className="input-group de-amt"><span className="prefix">Tk.</span>
                <input className="input" inputMode="decimal" value={docDiscount} placeholder="0" onChange={(e) => setDocDiscount(e.target.value)} /></div>
            </div>
            {showRound && (
              <div className="de-sumrow">
                <span className="row" style={{ gap: ".45rem" }}><Switch on={roundOn} onChange={setRoundOn} />Round Off</span>
                <span className={roundOff < 0 ? "neg" : ""}>{roundOff > 0 ? "+ " : roundOff < 0 ? "− " : ""}{tk(Math.abs(roundOff))}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---------- Card 3: notes + payment ---------- */}
      <div className="card de-card de-bottom">
        <div className="de-left">
          <div className="field">
            <label className="label">Notes or Remarks</label>
            <textarea className="input" rows={3} value={notes} placeholder="Enter notes" onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Attach Images</label>
            <ImageAttach images={images} onChange={setImages} />
          </div>
          {showDue && (
            <div className="field" style={{ maxWidth: 220 }}>
              <label className="label">Due Date</label>
              <input className="input" type="date" value={dueDate} min={date} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          )}
        </div>
        <div className="de-right">
          <div className="de-total"><span>Total Amount</span><b>{tk(total)}</b></div>
          {!isQuote && (
            <>
              <div className="field">
                <div className="label between">
                  <span>{meta.payLabel}</span>
                  <label className="de-check">
                    <input type="checkbox" checked={effFully} disabled={forcedFull}
                      onChange={(e) => { setFully(e.target.checked); setFullyTouched(true); if (!e.target.checked) setReceived(""); }} />
                    {meta.fullyLabel}
                  </label>
                </div>
                <div className="input-group"><span className="prefix">Tk.</span>
                  <input className="input" inputMode="decimal" value={effFully ? String(total) : received} disabled={effFully} placeholder="0"
                    onChange={(e) => setReceived(e.target.value)} /></div>
                {forcedFull && <div className="sub">{meta.cashLabel} is always fully {meta.payLabel.startsWith("Paid") ? "paid" : "received"}. Select a party to keep a due.</div>}
              </div>
              <div className="field">
                <label className="label">Payment Mode</label>
                <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="de-sumrow de-due">
                <span>Balance Due</span>
                <b className={due > 0.004 ? "neg" : due < -0.004 ? "neg" : "pos"}>{tk(due)}</b>
              </div>
            </>
          )}
        </div>
      </div>

      {errors.length > 0 && (
        <div className="de-errors" role="alert">
          {errors.map((e, i) => <div key={i}><Icon name="info" size={14} />{e}</div>)}
        </div>
      )}

      {/* ---------- Sticky footer ---------- */}
      <div className="de-foot">
        <div className="de-foot-total">
          <span className="sub">Total</span><b>{tk(total)}</b>
          {!isQuote && due > 0.004 && <span className="sub neg">Due {tk(due)}</span>}
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={() => router.push(isEdit ? `/doc/${doc!.id}` : meta.path)} disabled={busy}>Cancel</button>
          <button type="button" className="btn" onClick={() => save("new")} disabled={busy}>Save &amp; New</button>
          <SplitButton label={busy ? "Saving…" : saveLabel} onClick={() => save("save")} disabled={busy}
            items={[
              { label: "Save & Print", icon: "printer", onClick: () => save("print") },
              { label: saveLabel, icon: "check", onClick: () => save("save") },
            ]} />
        </div>
      </div>

      {addParty !== null && (
        <QuickParty
          initialName={addParty} type={meta.partyType}
          onClose={() => setAddParty(null)}
          onSaved={(p) => { setAdded((a) => [...a, p]); choosePartyId(p.id); setAddParty(null); toast(`Party “${p.name}” added`); }}
        />
      )}
      {toastNode}
    </div>
  );
}

/* ---------- Quick add party ---------- */
function QuickParty({ initialName, type, onClose, onSaved }: {
  initialName: string; type: "customer" | "supplier"; onClose: () => void; onSaved: (p: EdParty) => void;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState("");
  const [ptype, setPtype] = useState<"customer" | "supplier">(type);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!name.trim()) { setErr("Full name is required."); return; }
    setBusy(true);
    const { ok, data } = await post<{ id: string }>("/api/parties", { op: "create", name: name.trim(), phone: phone.trim() || null, type: ptype, opening_balance: 0 });
    setBusy(false);
    if (!ok || !data.id) { setErr(data.error || "Could not add party."); return; }
    onSaved({ id: data.id, name: name.trim(), phone: phone.trim() || null, type: ptype, balance: 0 });
  }
  return (
    <Modal title="Add New Party" onClose={onClose} width={420} footer={
      <>
        <button className="btn" onClick={onClose}>Close</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save Party"}</button>
      </>
    }>
      <div className="field">
        <label className="label">Full Name <span className="req">*</span></label>
        <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }} placeholder="Enter full name" />
      </div>
      <div className="field">
        <label className="label">Phone Number</label>
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }} placeholder="01XXXXXXXXX" inputMode="tel" />
      </div>
      <div className="field">
        <label className="label">Party Type</label>
        <Seg value={ptype} onChange={setPtype} options={[{ v: "customer", l: "Customer" }, { v: "supplier", l: "Supplier" }]} />
      </div>
      {err && <div className="neg" style={{ fontSize: 12.5 }}>{err}</div>}
    </Modal>
  );
}
