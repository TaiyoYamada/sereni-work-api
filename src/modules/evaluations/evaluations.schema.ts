import { z } from "@hono/zod-openapi";

import type { evaluations } from "../../db/schema";

export type Evaluation = typeof evaluations.$inferSelect;
export type EvaluationWithName = Evaluation & { staffName: string };

const score = z.number().int().min(1).max(5);

export const evaluationResponseSchema = z
  .object({
    id: z.uuid(),
    assignmentId: z.uuid(),
    staffId: z.uuid(),
    staffName: z.string(),
    attitude: z.number().int().nullable(),
    aptitude: z.number().int().nullable(),
    communication: z.number().int().nullable(),
    accommodationFit: z.number().int().nullable(),
    continuity: z.number().int().nullable(),
    nextNote: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("Evaluation");

export type EvaluationResponse = z.infer<typeof evaluationResponseSchema>;

/** 自分の評価の登録・更新（割当×支援員でユニーク。再送信は上書き） */
export const upsertEvaluationSchema = z
  .object({
    assignmentId: z.uuid(),
    attitude: score.optional(),
    aptitude: score.optional(),
    communication: score.optional(),
    accommodationFit: score.optional(),
    continuity: score.optional(),
    nextNote: z.string().max(5000).optional(),
  })
  .openapi("UpsertEvaluation");

export type UpsertEvaluationInput = z.infer<typeof upsertEvaluationSchema>;

export const listEvaluationsQuerySchema = z.object({
  assignmentId: z.uuid(),
});

export const participantIdParamSchema = z.object({
  participantId: z.uuid(),
});

/**
 * 利用者の成長ポイント（実習ごとに評価を集約した時系列の 1 点）。
 * 各軸は同一割当に複数の支援員評価がある場合は平均、評価が無い軸は null。
 */
export const participantGrowthPointSchema = z
  .object({
    assignmentId: z.uuid(),
    companyName: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    attitude: z.number().nullable(),
    aptitude: z.number().nullable(),
    communication: z.number().nullable(),
    accommodationFit: z.number().nullable(),
    continuity: z.number().nullable(),
  })
  .openapi("ParticipantGrowthPoint");

export type ParticipantGrowthPoint = z.infer<typeof participantGrowthPointSchema>;

export function toEvaluationResponse(row: EvaluationWithName): EvaluationResponse {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
