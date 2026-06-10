import { pgTable, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { assignments } from "./assignments";
import { staff } from "./staff";

/**
 * 支援員評価（実習ごと）
 * 評価項目は現場ヒアリング後に確定する（設計書29章）。各 1〜5 のスケール。
 */
export const evaluations = pgTable(
  "evaluations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id),
    /** 実習態度 */
    attitude: smallint("attitude"),
    /** 作業適性 */
    aptitude: smallint("aptitude"),
    /** コミュニケーション */
    communication: smallint("communication"),
    /** 配慮の適合度 */
    accommodationFit: smallint("accommodation_fit"),
    /** 継続勤務可能性 */
    continuity: smallint("continuity"),
    /** 次回実習への所見 */
    nextNote: text("next_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("evaluations_assignment_staff_idx").on(table.assignmentId, table.staffId),
  ],
);
