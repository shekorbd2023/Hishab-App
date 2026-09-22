"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PrintBar from "@/components/PrintBar";
import PaymentDialog, { type PayAccount, type PayParty } from "@/components/PaymentDialog";
import { Dropdown, Icon, Modal, post, useToast } from "@/components/ui";
import type { PaymentRow } from "../../doc/load";

export default function ReceiptBar({ title, backHref, fileName, thermal, payment, parties, accounts }: {
  title: string; backHref: string; fileName: string; thermal: boolean; payment: PaymentRow; parties: PayParty[]; accounts: PayAccount[];
}) {
  const router = useRouter();
  const { toast, node } = useToast();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const kind: "in" | "out" = payment.kind === "out" ? "out" : "in";
  return (
    <>
      <PrintBar title={title} backHref={backHref} fileName={fileName} thermal={thermal}>
        <Dropdown items={[
          { label: "Edit Payment", icon: "edit", onClick: () => setEditing(true) },
          { sep: true },
          { label: "Delete Payment", icon: "trash", danger: true, onClick: () => setDeleting(true) },
        ]} trigger={(t) => <button type="button" className="btn btn-icon" onClick={t} aria-label="More actions"><Icon name="more" size={16} /></button>} />
      </PrintBar>
      {editing && (
        <PaymentDialog kind={kind} parties={parties} accounts={accounts}
          edit={{ id: payment.id, number: payment.number, date: payment.date, party_id: payment.party_id, amount: payment.amount, account_id: payment.account_id, note: payment.note, document_id: payment.document_id }}
          onClose={() => setEditing(false)} onDone={() => { setEditing(false); toast("Payment updated"); router.refresh(); }} />
      )}
      {deleting && (
        <Modal title={`Delete ${title}`} onClose={() => setDeleting(false)} width={420}
          footer={<><button className="btn" onClick={() => setDeleting(false)}>Cancel</button>
            <button className="btn btn-danger" onClick={async () => {
              const { ok, data } = await post("/api/payments", { op: "delete", id: payment.id });
              if (!ok) { toast(data.error || "Could not delete"); return; }
              router.push(backHref.startsWith("/doc/") ? backHref : kind === "in" ? "/payment-in" : "/payment-out"); router.refresh();
            }}>Delete</button></>}>
          <div>Delete this payment? Party and account balances will update.</div>
        </Modal>
      )}
      {node}
    </>
  );
}
