import { sql } from "drizzle-orm";
import { check, date, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { assignmentStatus } from "./enums";
import { participants } from "./participants";
import { staff } from "./staff";

/**
 * 実習割当
 * 状態遷移（DRAFT → PROPOSED → CONFIRMED → IN_PROGRESS → COMPLETED / CANCELLED）は
 * Service 層で管理する。確定済み（CONFIRMED 以降）の割当は直接上書きしない。
 */
export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    status: assignmentStatus("status").notNull().default("DRAFT"),
    /** 集合場所 */
    meetingPlace: text("meeting_place"),
    /** 実習全体の目標 */
    goal: text("goal"),
    /** 自動提案由来の場合の最適化実行 ID */
    optimizationRunId: uuid("optimization_run_id"),
    /** 提案理由（支援員が理解できる業務用語で保存。docs/optimization.md） */
    proposalReason: text("proposal_reason"),
    confirmedByStaffId: uuid("confirmed_by_staff_id").references(() => staff.id),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    /** 中止理由（CANCELLED の場合） */
    cancelledReason: text("cancelled_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("assignments_period_check", sql`${table.endDate} >= ${table.startDate}`),
    index("assignments_participant_idx").on(table.participantId),
    index("assignments_company_idx").on(table.companyId),
    index("assignments_status_idx").on(table.status),
  ],
);
