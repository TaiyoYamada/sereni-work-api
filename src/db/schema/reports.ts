import {
  boolean,
  date,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { assignments } from "./assignments";
import { reportStatus } from "./enums";
import { participants } from "./participants";
import { staff } from "./staff";

/**
 * 実習前チェック
 * 各 1〜5 のスケール項目は現場ヒアリング後に確定する（設計書29章）。
 */
export const preChecks = pgTable(
  "pre_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id),
    checkDate: date("check_date").notNull(),
    /** 体調（1-5） */
    condition: smallint("condition"),
    /** 睡眠状態（1-5） */
    sleep: smallint("sleep"),
    /** 疲労度（1-5） */
    fatigue: smallint("fatigue"),
    /** 不安度（1-5） */
    anxiety: smallint("anxiety"),
    /** 今日の意欲（1-5） */
    motivation: smallint("motivation"),
    /** 実習に参加できそうか */
    canParticipate: boolean("can_participate"),
    /** 支援員への相談希望 */
    wantsConsultation: boolean("wants_consultation").notNull().default(false),
    /** 必要な配慮（当日分） */
    accommodationNotes: text("accommodation_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("pre_checks_assignment_date_idx").on(table.assignmentId, table.checkDate),
  ],
);

/**
 * 日報
 * 利用者本人が提出した文章は原文として必ず保持する。支援員の修正は reportRevisions に積む。
 * 入力項目は現場ヒアリング後に確定する（設計書29章）。
 */
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id),
    reportDate: date("report_date").notNull(),
    status: reportStatus("status").notNull().default("DRAFT"),
    /** 今日行った作業 */
    workDescription: text("work_description"),
    /** できたこと */
    didWell: text("did_well"),
    /** 難しかったこと */
    difficult: text("difficult"),
    /** 楽しかったこと */
    enjoyed: text("enjoyed"),
    /** 困ったこと */
    troubled: text("troubled"),
    /** 満足度（1-5） */
    satisfaction: smallint("satisfaction"),
    /** 疲労度（1-5） */
    fatigue: smallint("fatigue"),
    /** 不安度（1-5） */
    anxiety: smallint("anxiety"),
    /** 作業難易度（1-5） */
    difficulty: smallint("difficulty"),
    /** 職場の居心地（1-5） */
    comfort: smallint("comfort"),
    /** 指示の分かりやすさ（1-5） */
    instructionClarity: smallint("instruction_clarity"),
    /** 継続して働きたいか（1-5） */
    wantsToContinue: smallint("wants_to_continue"),
    /** 配慮が十分だったか */
    accommodationSufficient: boolean("accommodation_sufficient"),
    /** 支援員に相談したいか */
    wantsConsultation: boolean("wants_consultation").notNull().default(false),
    /** 自由記述（原文。上書き禁止） */
    freeText: text("free_text"),
    /** 原文の言語 */
    language: text("language").notNull().default("ja"),
    /** iOS からの重複送信防止用（クライアント生成 ID = 冪等キー） */
    clientGeneratedId: uuid("client_generated_id").unique(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    /** 面談必要フラグ（支援員が設定） */
    interviewNeeded: boolean("interview_needed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("reports_assignment_date_idx").on(table.assignmentId, table.reportDate),
    index("reports_participant_idx").on(table.participantId),
    index("reports_status_idx").on(table.status),
  ],
);

/** 支援員コメント */
export const reportComments = pgTable("report_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: uuid("report_id")
    .notNull()
    .references(() => reports.id),
  staffId: uuid("staff_id")
    .notNull()
    .references(() => staff.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** 日報修正履歴（原文を上書きせず、修正者・日時・理由・変更前の内容を保存する） */
export const reportRevisions = pgTable("report_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: uuid("report_id")
    .notNull()
    .references(() => reports.id),
  revisedByStaffId: uuid("revised_by_staff_id")
    .notNull()
    .references(() => staff.id),
  reason: text("reason").notNull(),
  /** 修正前のフィールド内容のスナップショット */
  previousContent: jsonb("previous_content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** 日報翻訳（原文は reports 側に必ず保持。docs/database.md） */
export const reportTranslations = pgTable(
  "report_translations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id),
    sourceLanguage: text("source_language").notNull(),
    targetLanguage: text("target_language").notNull(),
    /** 翻訳対象フィールドごとの翻訳文 */
    translatedContent: jsonb("translated_content").notNull(),
    translationService: text("translation_service").notNull(),
    translatedAt: timestamp("translated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("report_translations_report_lang_idx").on(table.reportId, table.targetLanguage),
  ],
);
