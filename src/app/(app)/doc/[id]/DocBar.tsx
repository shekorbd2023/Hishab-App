"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PrintBar from "@/components/PrintBar";
import PaymentDialog, { type PayAccount, type PayParty } from "@/components/PaymentDialog";
import { Dropdown, Icon, Modal, post, useToast, type MenuItem } from "@/components/ui";

const CONVERT: Record<string, { to: string; label: string } | undefined> = {
  sales_invoice: { to: "sales_return", label: "Convert to Sales Return" },
  purchase_bill: { to: "purchase_return", label: "Convert to Purchase Return" },
  quotation: { to: "sales_invoice", label: "Convert to Sales Invoice" },
};

export default function DocBar({
  id, kind, title, backHref, fileName, thermal, partyId, partyPhone, due, parties, accounts, nextIn, nextOut, summary,
}: {
  id: string; kind: string; title: string; backHref: string; fileName: string; thermal: boolean;
  partyId: string | null; partyPhone: string | null; due: number; parties: PayParty[]; accounts: PayAccount[];
  nextIn: number; nextOut: number; summary: string;
}) {
  const router = useRouter();
  const { toast, node } = useToast();
  const [paying, setPaying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const payKind: "in" | "out" = kind === "sales_invoice" || kind === "purchase_return" ? "in" : "out";

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    const { ok, data } = await post<{ id: string }>("/api/documents", body);
    setBusy(false);
    if (!ok) { toast(data.error || "Something went wrong"); return; }
    router.push(`/documents/${data.id}/edit`);
  }
  const phone = (partyPhone || "").replace(/\D/g, "");
  const wa = phone ? (phone.startsWith("880") ? phone : phone.startsWith("0") ? "88" + phone : phone) : "";
  const conv = CONVERT[kind];
  const items: MenuItem[] = [
    { label: kind === "purchase_bill" ? "Edit Bill" : "Edit Invoice", icon: "edit", onClick: () => router.push(`/documents/${id}/edit`) },
    { label: "Duplicate Transaction", icon: "copy", onClick: () => act({ op: "duplicate", id }) },
  ];
  if (conv) items.push({ label: conv.label, icon: "swap", onClick: () => act({ op: "convert", id, to: conv.to }) });
  if (kind !== "quotation" && due > 0.004) items.push({ label: payKind === "in" ? "Record Payment In" : "Record Payment Out", icon: "wallet", onClick: () => setPaying(true) });
  items.push({ label: "Share on WhatsApp", icon: "whatsapp", onClick: () => window.open(`https://wa.me/${wa}?text=${encodeURIComponent(summary)}`, "_blank") });
  items.push({ sep: true }, { label: kind === "purchase_bill" ? "Delete Bill" : "Delete Invoice", icon: "trash", danger: true, onClick: () => setDeleting(true) });

  return (
    <>
      <PrintBar title={title} backHref={backHref} fileName={fileName} thermal={thermal}>
        <Dropdown items={items} trigger={(t) => (
          <button type="button" className="btn btn-icon" onClick={t} aria-label="More actions" disabled={busy}><Icon name="more" size={16} /></button>
        )} />
      </PrintBar>
      {paying && (
        <PaymentDialog kind={payKind} parties={parties} accounts={accounts} nextNumber={payKind === "in" ? nextIn : nextOut}
          defaults={{ partyId, amount: due, documentId: id }} onClose={() => setPaying(false)}
          onDone={() => { setPaying(false); toast("Payment recorded"); router.refresh(); }} />
      )}
      {deleting && (
        <Modal title={`Delete ${title}`} onClose={() => setDeleting(false)} width={420}
          footer={<><button className="btn" onClick={() => setDeleting(false)}>Cancel</button>
            <button className="btn btn-danger" disabled={busy} onClick={async () => {
              setBusy(true);
              const { ok, data } = await post("/api/documents", { op: "delete", id });
              setBusy(false);
              if (!ok) { toast(data.error || "Could not delete"); return; }
              router.push(backHref); router.refresh();
            }}>Delete</button></>}>
          <div>This removes {title} and the payment recorded with it. Stock and balances will update. This cannot be undone.</div>
        </Modal>
      )}
      {node}
    </>
  );
}
