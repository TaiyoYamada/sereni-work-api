import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * 監査ログ（設計書20章）
 * 追記専用。更新・削除はしない。対象操作の一覧は docs/permissions.md。
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** 操作者の種別（staff / participant / system） */
    actorType: text("actor_type").notNull(),
    actorId: uuid("actor_id"),
    /** 操作内容（login / participant.view / assignment.confirm 等） */
    action: text("action").notNull(),
    /** 対象データ種別（participant / report / assignment 等） */
    targetType: text("target_type"),
    targetId: uuid("target_id"),
    /** 変更前・変更後（個人情報を含むため閲覧は管理者のみ） */
    before: jsonb("before"),
    after: jsonb("after"),
    ipAddress: text("ip_address"),
    traceId: text("trace_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_target_idx").on(table.targetType, table.targetId),
    index("audit_logs_actor_idx").on(table.actorType, table.actorId),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ],
);
