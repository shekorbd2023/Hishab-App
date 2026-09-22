import { all } from "@/lib/db";
import { paymentPickers } from "../doc/load";
import type { PayRow } from "./PaymentList";

export function loadPayments(bid: string, kind: "in" | "out") {
  const rows = all<PayRow>(
    `SELECT p.id, p.number, p.date, p.party_id, p.account_id, p.amount, p.note, p.images, p.document_id,
            pa.name party, a.name account
     FROM payments p LEFT JOIN parties pa ON pa.id=p.party_id LEFT JOIN accounts a ON a.id=p.account_id
     WHERE p.business_id=? AND p.kind=? AND p.is_auto=0 ORDER BY p.date DESC, p.number DESC`, [bid, kind]
  );
  const counter = all<{ value: number }>("SELECT value FROM counters WHERE business_id=? AND kind=?", [bid, kind === "in" ? "payment_in" : "payment_out"]);
  return { rows, ...paymentPickers(bid), nextNumber: (counter[0]?.value ?? 0) + 1 };
}
