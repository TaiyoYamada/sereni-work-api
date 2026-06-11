import { z } from "@hono/zod-openapi";

import { paginationQuerySchema } from "../../lib/schemas";
import type { optimizationRuns } from "../../db/schema";

export type OptimizationRun = typeof optimizationRuns.$inferSelect;

export const solverSchema = z.enum(["sa", "sqa", "exact", "dwave"]);

/** 条件の重み（業務用語。Web では「希望を重視」等のスライダーとして提示する） */
export const weightsSchema = z
  .object({
    desire: z.number().min(0).max(2).default(1.0).describe("希望職種との一致を重視"),
    skill: z.number().min(0).max(2).default(0.8).describe("スキルとの一致を重視"),
    fairness: z.number().min(0).max(2).default(0.5).describe("実習機会の公平性を重視"),
    rotation: z.number().min(0).max(2).default(0.3).describe("新しい経験を重視"),
  })
  .openapi("OptimizationWeights");

export type OptimizationWeights = z.infer<typeof weightsSchema>;

export const createRunSchema = z
  .object({
    participantIds: z.array(z.uuid()).min(1).max(50),
    companyIds: z.array(z.uuid()).min(1).max(50),
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
    solver: solverSchema.default("sa"),
    weights: weightsSchema.partial().optional(),
    seed: z.number().int().min(0).optional(),
    numReads: z.number().int().min(1).max(2000).optional(),
    maxCandidates: z.number().int().min(1).max(10).default(3),
  })
  .refine((v) => v.periodEnd >= v.periodStart, {
    message: "終了日は開始日以降にしてください",
    path: ["periodEnd"],
  })
  .openapi("CreateOptimizationRun");

export type CreateRunInput = z.infer<typeof createRunSchema>;

/** 保存・表示用の候補（実 ID + 表示名 + 日本語の提案理由に変換済み） */
export const storedCandidateSchema = z
  .object({
    assignments: z.array(
      z.object({
        participantId: z.uuid(),
        participantName: z.string(),
        companyId: z.uuid(),
        companyName: z.string(),
        startDate: z.iso.date(),
        endDate: z.iso.date(),
        reasons: z.array(z.string()),
      }),
    ),
    score: z.number(),
    scoreBreakdown: z.record(z.string(), z.number()),
    violations: z.array(z.string()),
    energy: z.number().nullable(),
  })
  .openapi("OptimizationCandidate");

export type StoredCandidate = z.infer<typeof storedCandidateSchema>;

export const runResponseSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(["PENDING", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"]),
    solver: z.string(),
    periodStart: z.iso.datetime(),
    periodEnd: z.iso.datetime(),
    participantIds: z.array(z.uuid()),
    companyIds: z.array(z.uuid()),
    weights: z.record(z.string(), z.number()),
    variableCount: z.number().int().nullable(),
    constraintCount: z.number().int().nullable(),
    executionTimeMs: z.number().int().nullable(),
    energy: z.number().nullable(),
    violationCount: z.number().int().nullable(),
    errorMessage: z.string().nullable(),
    candidates: z.array(storedCandidateSchema).nullable(),
    selectedCandidate: storedCandidateSchema.nullable(),
    executedByStaffId: z.uuid(),
    createdAt: z.iso.datetime(),
  })
  .openapi("OptimizationRun");

export type RunResponse = z.infer<typeof runResponseSchema>;

export const adoptCandidateSchema = z
  .object({ candidateIndex: z.number().int().min(0).max(9) })
  .openapi("AdoptCandidate");

export const listRunsQuerySchema = paginationQuerySchema;

export function toRunResponse(row: OptimizationRun): RunResponse {
  return {
    id: row.id,
    status: row.status,
    solver: row.solver,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    participantIds: row.participantIds,
    companyIds: row.companyIds,
    weights: row.weights as Record<string, number>,
    variableCount: row.variableCount,
    constraintCount: row.constraintCount,
    executionTimeMs: row.executionTimeMs,
    energy: row.energy,
    violationCount: row.violationCount,
    errorMessage: row.errorMessage,
    candidates: (row.candidates as StoredCandidate[] | null) ?? null,
    selectedCandidate: (row.selectedCandidate as StoredCandidate | null) ?? null,
    executedByStaffId: row.executedByStaffId,
    createdAt: row.createdAt.toISOString(),
  };
}
