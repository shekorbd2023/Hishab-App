import { run } from "./db";
import { uid, nowIso } from "./util";

export function logAudit(opts: {
  businessId: string;
  userId?: string;
  userName?: string;
  action: "create" | "update" | "delete";
  entity: string;
  entityId?: string;
  summary?: string;
  before?: unknown;
  after?: unknown;
}) {
  try {
    run(
      `INSERT INTO audit_log (id, business_id, user_id, user_name, action, entity, entity_id, summary, before_json, after_json, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uid(),
        opts.businessId,
        opts.userId ?? null,
        opts.userName ?? null,
        opts.action,
        opts.entity,
        opts.entityId ?? null,
        opts.summary ?? null,
        opts.before ? JSON.stringify(opts.before) : null,
        opts.after ? JSON.stringify(opts.after) : null,
        nowIso(),
      ]
    );
  } catch {
    /* audit must never break the main operation */
  }
}
