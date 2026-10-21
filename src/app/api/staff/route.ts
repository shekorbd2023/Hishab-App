import { NextResponse } from "next/server";
import { requireCtx, ROLES } from "@/lib/auth";
import { get, run } from "@/lib/db";
import { uid, nowIso } from "@/lib/util";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const ctx = await requireCtx();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role !== "Owner" && ctx.role !== "Admin") return NextResponse.json({ error: "Owner/Admin only." }, { status: 403 });
  const bid = ctx.business.id;
  const body = await req.json();
  const op = body.op as string;
  const isOwner = ctx.role === "Owner";
  // Roles a caller may hand out: nobody can create a second Owner here; Admins can't create Admins.
  const assignable = isOwner ? ["Admin", "Partner", "Staff"] : ["Partner", "Staff"];
  const targetRole = (uid_: unknown) =>
    get<{ role: string }>("SELECT role FROM business_members WHERE business_id=? AND user_id=?", [bid, String(uid_ || "")])?.role;
  // Admins may only manage Partner/Staff members; nobody may change or remove the Owner or themselves.
  const canManage = (uid_: unknown) => {
    const r = targetRole(uid_);
    if (!r) return "Member not found.";
    if (uid_ === ctx.business.owner_id || r === "Owner") return "The owner's access can't be changed.";
    if (uid_ === ctx.user.id) return "You can't change your own access.";
    if (!isOwner && r === "Admin") return "Only the owner can change an admin.";
    return null;
  };

  if (op === "invite") {
    const email = String(body.email || "").toLowerCase();
    const user = get<{ id: string; name: string }>("SELECT id, name FROM users WHERE email = ?", [email]);
    const role = body.role || "Staff";
    if (!(ROLES as readonly string[]).includes(role) || !assignable.includes(role)) return NextResponse.json({ error: "You can't give that role." }, { status: 403 });
    if (!user) return NextResponse.json({ error: "No Hishab account with that email. Ask them to sign up first." }, { status: 404 });
    const existing = get("SELECT id FROM business_members WHERE business_id=? AND user_id=?", [bid, user.id]);
    if (existing) return NextResponse.json({ error: "Already a member." }, { status: 409 });
    run("INSERT INTO business_members (id, business_id, user_id, role, status, joined_at) VALUES (?,?,?,?,?,?)",
      [uid(), bid, user.id, role, "Accepted", nowIso()]);
    logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "create", entity: "staff", summary: `Added ${user.name} as ${role}` });
    return NextResponse.json({ ok: true });
  }
  if (op === "role") {
    const err = canManage(body.user_id);
    if (err) return NextResponse.json({ error: err }, { status: 403 });
    if (!assignable.includes(body.role)) return NextResponse.json({ error: "You can't give that role." }, { status: 403 });
    run("UPDATE business_members SET role=? WHERE business_id=? AND user_id=?", [body.role, bid, body.user_id]);
    logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "update", entity: "staff", summary: `Changed role to ${body.role}` });
    return NextResponse.json({ ok: true });
  }
  if (op === "permissions") {
    const err = canManage(body.user_id);
    if (err) return NextResponse.json({ error: err }, { status: 403 });
    const json = JSON.stringify(body.permissions || {});
    run("UPDATE business_members SET permissions=? WHERE business_id=? AND user_id=?", [json, bid, body.user_id]);
    logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "update", entity: "staff", summary: "Updated staff permissions" });
    return NextResponse.json({ ok: true });
  }
  if (op === "remove") {
    const err = canManage(body.user_id);
    if (err) return NextResponse.json({ error: err }, { status: 403 });
    run("DELETE FROM business_members WHERE business_id=? AND user_id=?", [bid, body.user_id]);
    logAudit({ businessId: bid, userId: ctx.user.id, userName: ctx.user.name, action: "delete", entity: "staff", summary: `Removed a member` });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown op" }, { status: 400 });
}
