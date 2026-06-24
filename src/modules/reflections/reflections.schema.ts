import { z } from "@hono/zod-openapi";

import type { reflections } from "../../db/schema";

export type Reflection = typeof reflections.$inferSelect;
export type ReflectionWithName = Reflection & { staffName: string };

export const reflectionResponseSchema = z
  .object({
    id: z.uuid(),
    participantId: z.uuid(),
    staffId: z.uuid(),
    staffName: z.string(),
    meetingDate: z.string(),
    notes: z.string(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("Reflection");

export type ReflectionResponse = z.infer<typeof reflectionResponseSchema>;

export const createReflectionSchema = z
  .object({
    participantId: z.uuid(),
    meetingDate: z.iso.date(),
    notes: z.string().min(1).max(5000),
  })
  .openapi("CreateReflection");

export type CreateReflectionInput = z.infer<typeof createReflectionSchema>;

export const reflectionParticipantParamSchema = z.object({
  participantId: z.uuid(),
});

export const reflectionIdParamSchema = z.object({
  id: z.uuid(),
});

/** 振り返り記録の更新（面談日・記録）。少なくとも1項目は必要 */
export const updateReflectionSchema = z
  .object({
    meetingDate: z.iso.date().optional(),
    notes: z.string().min(1).max(5000).optional(),
  })
  .refine((value) => value.meetingDate !== undefined || value.notes !== undefined, {
    message: "更新する項目がありません",
  })
  .openapi("UpdateReflection");

export type UpdateReflectionInput = z.infer<typeof updateReflectionSchema>;

export function toReflectionResponse(row: ReflectionWithName): ReflectionResponse {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
