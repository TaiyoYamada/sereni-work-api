import { pgEnum } from "drizzle-orm/pg-core";

/** 職員ロール（docs/permissions.md） */
export const staffRole = pgEnum("staff_role", ["admin", "staff", "viewer"]);

/** 実習割当の状態（状態遷移は API 側で管理。docs/database.md） */
export const assignmentStatus = pgEnum("assignment_status", [
  "DRAFT",
  "PROPOSED",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

/** 日報の状態 */
export const reportStatus = pgEnum("report_status", [
  "DRAFT",
  "SUBMITTED",
  "REVIEWED",
  "NEEDS_ACTION",
]);

/** 最適化実行の状態 */
export const optimizationRunStatus = pgEnum("optimization_run_status", [
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
]);
