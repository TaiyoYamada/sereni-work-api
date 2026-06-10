import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { staffRole } from "./enums";

/** 職員（管理者・支援員・閲覧者） */
export const staff = pgTable("staff", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Supabase Auth の auth.users.id（auth スキーマは Supabase 管理のため FK は張らない） */
  authUserId: uuid("auth_user_id").unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: staffRole("role").notNull().default("staff"),
  /** 停止されたアカウントは false（認可ミドルウェアで確認する） */
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
