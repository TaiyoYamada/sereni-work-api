import { z } from "@hono/zod-openapi";

import { supportStages } from "../../db/schema";
import { paginationQuerySchema, sortOrderSchema } from "../../lib/schemas";
import type { Participant } from "../../lib/types";

export const supportedLanguages = ["ja", "en", "zh-Hans", "vi", "ko", "pt"] as const;

export const participantResponseSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    kana: z.string().nullable(),
    email: z.string().nullable(),
    preferredLanguage: z.string(),
    desiredOccupations: z.array(z.string()),
    skills: z.array(z.string()),
    strengths: z.string().nullable(),
    weaknesses: z.string().nullable(),
    accommodations: z.array(z.string()),
    commuteConditions: z.string().nullable(),
    needsTransport: z.boolean(),
    assignedStaffId: z.uuid().nullable(),
    stage: z.enum(supportStages),
    serviceStartDate: z.string().nullable(),
    recipientCertNumber: z.string().nullable(),
    recipientCertExpiry: z.string().nullable(),
    notes: z.string().nullable(),
    isActive: z.boolean(),
    /** アカウント発行済み（Supabase Auth ユーザーが紐付いている）か */
    hasAccount: z.boolean(),
    /** 発行済みアカウントのログイン ID（未発行は null） */
    loginId: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("Participant");

export type ParticipantResponse = z.infer<typeof participantResponseSchema>;

export const createParticipantSchema = z
  .object({
    name: z.string().min(1).max(100),
    kana: z.string().max(100).optional(),
    email: z.email().optional(),
    preferredLanguage: z.enum(supportedLanguages).default("ja"),
    desiredOccupations: z.array(z.string().min(1)).default([]),
    skills: z.array(z.string().min(1)).default([]),
    strengths: z.string().max(2000).optional(),
    weaknesses: z.string().max(2000).optional(),
    accommodations: z.array(z.string().min(1)).default([]),
    commuteConditions: z.string().max(2000).optional(),
    needsTransport: z.boolean().default(false),
    assignedStaffId: z.uuid().optional(),
    stage: z.enum(supportStages).default("ASSESSMENT"),
    // 日付・受給者証は null で明示的にクリアできる（作成・更新で共通のペイロードを使えるように）
    serviceStartDate: z.iso.date().nullable().optional(),
    recipientCertNumber: z.string().max(100).nullable().optional(),
    recipientCertExpiry: z.iso.date().nullable().optional(),
    notes: z.string().max(5000).optional(),
  })
  .openapi("CreateParticipant");

export type CreateParticipantInput = z.infer<typeof createParticipantSchema>;

export const updateParticipantSchema = createParticipantSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .openapi("UpdateParticipant");

export type UpdateParticipantInput = z.infer<typeof updateParticipantSchema>;

export const listParticipantsQuerySchema = paginationQuerySchema.extend({
  /** 名前・かなの部分一致検索 */
  q: z.string().max(100).optional(),
  assignedStaffId: z.uuid().optional(),
  isActive: z.stringbool().optional(),
  sort: z.enum(["name", "createdAt"]).default("createdAt"),
  order: sortOrderSchema.default("desc"),
});

export type ListParticipantsQuery = z.infer<typeof listParticipantsQuerySchema>;

export function toParticipantResponse(row: Participant): ParticipantResponse {
  // authUserId は内部キーのためレスポンスへ含めない（hasAccount に変換する）
  const { authUserId, ...rest } = row;
  return {
    ...rest,
    hasAccount: authUserId !== null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** アカウント発行・再発行の結果。initialPassword はこのレスポンスでのみ取得できる */
export const participantAccountResponseSchema = z
  .object({
    loginId: z.string(),
    initialPassword: z.string(),
  })
  .openapi("ParticipantAccount");

export type ParticipantAccountResponse = z.infer<typeof participantAccountResponseSchema>;
