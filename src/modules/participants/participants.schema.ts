import { z } from "@hono/zod-openapi";

import { paginationQuerySchema } from "../../lib/schemas";
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
    notes: z.string().nullable(),
    isActive: z.boolean(),
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
});

export type ListParticipantsQuery = z.infer<typeof listParticipantsQuerySchema>;

export function toParticipantResponse(row: Participant): ParticipantResponse {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
