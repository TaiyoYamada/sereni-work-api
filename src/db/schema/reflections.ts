import { date, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { participants } from "./participants";
import { staff } from "./staff";

/**
 * 1対1振り返り記録（毎週金曜の面談など、職員と利用者の振り返り）。
 * 利用者本人の入力ではなく、職員が記録する。
 */
export const reflections = pgTable(
  "reflections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id),
    /** 記録した職員 */
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id),
    /** 面談日 */
    meetingDate: date("meeting_date").notNull(),
    /** 振り返りの記録 */
    notes: text("notes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("reflections_participant_idx").on(table.participantId)],
);
