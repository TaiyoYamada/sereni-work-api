import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * 実習先企業
 * 登録項目は現場ヒアリング後に確定する（設計書29章）。
 */
export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** 業種 */
  industry: text("industry"),
  /** 実習内容 */
  internshipDescription: text("internship_description"),
  /** 必要スキル */
  requiredSkills: text("required_skills").array().notNull().default([]),
  /** 対応可能な配慮事項 */
  supportedAccommodations: text("supported_accommodations").array().notNull().default([]),
  /** 同時に受け入れ可能な人数 */
  capacity: integer("capacity").notNull().default(1),
  /** 受け入れ可能日程（枠管理の方法が確定するまでは自由記述） */
  availableSchedule: text("available_schedule"),
  /** 勤務時間 */
  workHours: text("work_hours"),
  /** 担当者 */
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  /** 所在地 */
  address: text("address"),
  /** 持ち物・服装 */
  belongings: text("belongings"),
  /** 緊急連絡先 */
  emergencyContact: text("emergency_contact"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
