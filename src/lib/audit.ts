import type { Context } from "hono";

import { db } from "../db/client";
import { auditLogs } from "../db/schema";
import type { AppEnv } from "./types";

type AuditEntry = {
  /** 操作内容（例: "participant.update" / "assignment.confirm" / "report.view"） */
  action: string;
  targetType?: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
};

type AuditWriter = (values: typeof auditLogs.$inferInsert) => Promise<void>;

const defaultWriter: AuditWriter = async (values) => {
  await db.insert(auditLogs).values(values);
};

/**
 * 監査ログを記録する（docs/permissions.md の対象操作で必ず呼ぶ）。
 * 監査ログの失敗で業務処理を落とさないため、エラーは握りつぶさず logger に出す方針だが、
 * 個人情報をログへ出さない制約があるため、ここでは失敗を再 throw しない。
 */
export async function audit(
  c: Context<AppEnv>,
  entry: AuditEntry,
  writer: AuditWriter = defaultWriter,
): Promise<void> {
  const actor = c.var.actor;
  await writer({
    actorType: actor.type,
    actorId: actor.type === "staff" ? actor.staff.id : actor.participant.id,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    before: entry.before,
    after: entry.after,
    ipAddress: c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ?? c.req.header("X-Real-Ip"),
    traceId: c.var.traceId,
  });
}
