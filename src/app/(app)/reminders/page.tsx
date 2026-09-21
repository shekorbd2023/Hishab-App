import { requireCtx } from "@/lib/auth";
import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import RemindersClient from "./RemindersClient";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const ctx = await requireCtx();
  if (!ctx) redirect("/login");
  const bid = ctx.business.id;
  const reminders = all<{ id: string; due_date: string; note: string | null; done: number; pname: string | null; party_id: string | null }>(
    `SELECT r.id, r.due_date, r.note, r.done, r.party_id, p.name pname FROM reminders r
     LEFT JOIN parties p ON p.id = r.party_id WHERE r.business_id = ? ORDER BY r.done, r.due_date`, [bid]
  );
  const parties = all<{ id: string; name: string }>("SELECT id, name FROM parties WHERE business_id = ? ORDER BY name COLLATE NOCASE", [bid]);
  return <RemindersClient reminders={reminders} parties={parties} />;
}
