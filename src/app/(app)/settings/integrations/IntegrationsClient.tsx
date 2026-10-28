"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { post, useToast } from "@/components/ui";
import { fmtDate, tk } from "@/lib/format";
import { PageTitle, Section, Row } from "../SettingsKit";

type Key = { id: string; name: string; prefix: string; created_at: string; last_used_at: string | null };
type Order = { id: string; order_number: string | null; external_id: string; status: string; error: string | null; unmatched: string | null; updated_at: string; document_id: string | null; number: number | null; total: number | null };
type Um = { key: string; name: string; orders: number };
type Map_ = { external_key: string; item_id: string; factor: number; name: string };
type Item = { id: string; name: string; unit: string | null };

function LinkRow({ k, name, items, current, factor, sub, onSaved }: { k: string; name: string; items: Item[]; current?: string; factor?: number; sub?: string; onSaved: (msg: string) => void }) {
  const [item, setItem] = useState(current || "");
  const [f, setF] = useState(String(factor || 1));
  async function save() {
    const { ok, data } = await post<{ resynced: number }>("/api/integrations", { op: "map_item", key: k, name, itemId: item || null, factor: Number(f) || 1 });
    onSaved(ok ? (item ? `Linked${data.resynced ? ` · ${data.resynced} invoice(s) updated` : ""}` : "Link removed") : data.error || "Could not save");
  }
  return (
    <div className="set-row" style={{ flexWrap: "wrap" }}>
      <div style={{ minWidth: 0, flex: "1 1 220px" }}>
        <div className="set-row-title">{name}</div>
        <div className="sub">{sub || k}</div>
      </div>
      <div className="row" style={{ gap: ".5rem", flexWrap: "wrap" }}>
        <select className="input" style={{ width: 240 }} value={item} onChange={(e) => setItem(e.target.value)}>
          <option value="">— Not linked —</option>
          {items.map((i) => <option key={i.id} value={i.id}>{i.name}{i.unit ? ` (${i.unit})` : ""}</option>)}
        </select>
        <label className="sub" title="Hishab quantity for 1 website unit, e.g. 0.5 if the website sells 500 g and the item is counted in kg">
          × <input className="input" style={{ width: 70 }} value={f} onChange={(e) => setF(e.target.value)} inputMode="decimal" />
        </label>
        <button className="btn btn-primary" onClick={save}>Save</button>
      </div>
    </div>
  );
}

export default function IntegrationsClient({ manager, origin, keys, orders, unmatched, maps, items }: { manager: boolean; origin: string; keys: Key[]; orders: Order[]; unmatched: Um[]; maps: Map_[]; items: Item[] }) {
  const router = useRouter();
  const { toast, node } = useToast();
  const [newKey, setNewKey] = useState<string | null>(null);
  const endpoint = `${origin}/api/integrations/orders`;
  async function createKey() {
    const { ok, data } = await post<{ key: string }>("/api/integrations", { op: "create_key", name: "Shekor website" });
    if (!ok) { toast(data.error || "Could not create key"); return; }
    setNewKey(data.key); router.refresh();
  }
  async function revoke(id: string) {
    if (!confirm("Revoke this key? The website will stop sending orders until it gets a new key.")) return;
    const { ok, data } = await post("/api/integrations", { op: "revoke_key", id });
    toast(ok ? "Key revoked" : data.error || "Could not revoke"); router.refresh();
  }
  const copy = (s: string) => { navigator.clipboard?.writeText(s).then(() => toast("Copied"), () => toast("Copy it manually")); };
  const saved = (m: string) => { toast(m); router.refresh(); };

  return (
    <div>
      <PageTitle>Integrations</PageTitle>

      <Section title="Website orders → Hishab" hint="When an order is confirmed on your website, it becomes a sales invoice here automatically (customer, items, delivery charge, discount). ওয়েবসাইটে অর্ডার কনফার্ম করলে এখানে নিজে থেকেই সেলস ইনভয়েস তৈরি হবে।">
        <Row title="Endpoint (HISHAB_URL)" desc="Put this in the website's environment variables.">
          <div className="row" style={{ gap: ".4rem" }}><code style={{ fontSize: ".8rem", wordBreak: "break-all" }}>{origin}</code><button className="btn" onClick={() => copy(origin)}>Copy</button></div>
        </Row>
        {manager ? (
          <>
            {keys.map((k) => (
              <Row key={k.id} title={`${k.name} · ${k.prefix}…`} desc={`Created ${fmtDate(k.created_at.slice(0, 10))} · ${k.last_used_at ? "last used " + fmtDate(k.last_used_at.slice(0, 10)) : "not used yet"}`}>
                <button className="btn" onClick={() => revoke(k.id)}>Revoke</button>
              </Row>
            ))}
            {newKey && (
              <div className="set-row" style={{ background: "var(--surface-2, #f4fbf7)", flexDirection: "column", alignItems: "stretch" }}>
                <div className="set-row-title">New API key (HISHAB_API_KEY) — copy it now, it will not be shown again</div>
                <div className="row" style={{ gap: ".4rem" }}><code style={{ fontSize: ".8rem", wordBreak: "break-all", flex: 1 }}>{newKey}</code><button className="btn btn-primary" onClick={() => copy(newKey)}>Copy</button></div>
              </div>
            )}
            <Row title={keys.length ? "Make another key" : "Connect your website"} desc="Creates a secret key the website uses to send orders. Keep it private.">
              <button className="btn btn-primary" onClick={createKey}>Create API Key</button>
            </Row>
          </>
        ) : <Row title="Only the Owner or an Admin can manage API keys." />}
      </Section>

      {unmatched.length > 0 && (
        <Section title="Products to link" hint="These website products did not match any item, so their stock and FIFO profit are not tracked yet. Pick the item; the invoices are updated right away.">
          {unmatched.map((u) => <LinkRow key={u.key} k={u.key} name={u.name} items={items} sub={`In ${u.orders} order(s)`} onSaved={saved} />)}
        </Section>
      )}

      {maps.length > 0 && (
        <Section title="Linked products">
          {maps.map((m) => <LinkRow key={m.external_key} k={m.external_key} name={m.name} items={items} current={m.item_id} factor={m.factor} sub={`Website product ${m.external_key}`} onSaved={saved} />)}
        </Section>
      )}

      <Section title="Recent website orders">
        {orders.length === 0 ? <Row title="No website orders yet" desc="They will show here after the website sends its first confirmed order." /> : orders.map((o) => {
          const um = JSON.parse(o.unmatched || "[]").length;
          return (
            <Row key={o.id} title={o.order_number || o.external_id}
              desc={`${fmtDate(o.updated_at.slice(0, 10))} · ${o.status === "synced" ? "Synced" : o.status === "cancelled" ? "Cancelled — invoice removed" : "Error: " + (o.error || "")}${um ? ` · ${um} product(s) not linked` : ""}`}>
              {o.document_id && o.number ? <Link className="btn" href={`/doc/${o.document_id}`}>Sales #{o.number} · {tk(o.total || 0)}</Link> : null}
            </Row>
          );
        })}
      </Section>
      {node}
    </div>
  );
}
