import { boolean, date, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { supportStage } from "./enums";
import { staff } from "./staff";

/**
 * 利用者（就労移行支援の利用者本人）
 * 登録項目は現場ヒアリング後に確定する（設計書29章）。確定までは text / text[] で柔軟に持つ。
 */
export const participants = pgTable("participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Supabase Auth の auth.users.id。アカウントは職員が発行する */
  authUserId: uuid("auth_user_id").unique(),
  /**
   * 発行済みアカウントのログイン ID（docs/account-provisioning.md）。
   * 実メールを持たない利用者にはシステム生成 ID を使う。email は連絡先として独立に変更しうるため別カラムで持つ
   */
  loginId: text("login_id").unique(),
  name: text("name").notNull(),
  kana: text("kana"),
  email: text("email").unique(),
  /** 表示言語（ja / en / zh-Hans / vi / ko / pt） */
  preferredLanguage: text("preferred_language").notNull().default("ja"),
  /** 希望職種 */
  desiredOccupations: text("desired_occupations").array().notNull().default([]),
  /** スキル */
  skills: text("skills").array().notNull().default([]),
  /** 得意なこと */
  strengths: text("strengths"),
  /** 不得意なこと */
  weaknesses: text("weaknesses"),
  /** 必要な配慮（分類は確定後に正規化を検討） */
  accommodations: text("accommodations").array().notNull().default([]),
  /** 通勤条件 */
  commuteConditions: text("commute_conditions"),
  /** 送迎要否 */
  needsTransport: boolean("needs_transport").notNull().default(false),
  /** 担当支援員 */
  assignedStaffId: uuid("assigned_staff_id").references(() => staff.id),
  /** 支援パイプラインのステージ（既定はアセスメント） */
  stage: supportStage("stage").notNull().default("ASSESSMENT"),
  /** 利用開始日（最長2年の利用上限の起点） */
  serviceStartDate: date("service_start_date"),
  /** 受給者証番号 */
  recipientCertNumber: text("recipient_cert_number"),
  /** 受給者証の有効期限（支給決定期間の終了日） */
  recipientCertExpiry: date("recipient_cert_expiry"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
