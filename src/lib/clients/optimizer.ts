import { z } from "zod";

import { env } from "../../env";
import { AppError } from "../errors";

/**
 * 最適化 Lambda（optimizer/）の呼び出しクライアント。
 * 個人情報は渡さない: 匿名 ID（p0, c0, ...）と数値化された特徴のみを送る。
 * レスポンスは必ず Zod で検証する（Solver 結果を未検証のまま扱わない）。
 */

export type OptimizerRequest = {
  runId: string;
  solver: "sa" | "exact" | "dwave";
  seed?: number;
  numReads?: number;
  maxCandidates?: number;
  timeLimitMs?: number;
  periods: string[];
  participants: {
    id: string;
    desireMatch: Record<string, number>;
    skillMatch: Record<string, number>;
    accommodationOk: Record<string, boolean>;
    unavailablePeriods: string[];
    pastAssignmentCount: number;
    pastCompanyIds: string[];
  }[];
  companies: { id: string; capacity: Record<string, number> }[];
  weights: { desire: number; skill: number; fairness: number; rotation: number };
};

const candidateSchema = z.object({
  assignments: z.array(
    z.object({ participantId: z.string(), companyId: z.string(), periodId: z.string() }),
  ),
  score: z.number(),
  scoreBreakdown: z.record(z.string(), z.number()),
  violations: z.array(z.record(z.string(), z.unknown())),
  reasons: z.array(
    z.object({
      participantId: z.string(),
      companyId: z.string(),
      codes: z.array(z.string()),
    }),
  ),
  energy: z.number().nullable(),
});

export const optimizerResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("SUCCEEDED"),
    runId: z.string(),
    solver: z.string(),
    variableCount: z.number().int(),
    constraintCount: z.number().int(),
    executionTimeMs: z.number().int(),
    energy: z.number().nullable(),
    solverMetrics: z.record(z.string(), z.unknown()).optional(),
    candidates: z.array(candidateSchema),
  }),
  z.object({
    status: z.literal("FAILED"),
    runId: z.string().nullable(),
    errorMessage: z.string(),
    candidates: z.array(candidateSchema),
  }),
]);

export type OptimizerResponse = z.infer<typeof optimizerResponseSchema>;
export type OptimizerCandidate = z.infer<typeof candidateSchema>;

async function invokeViaHttp(request: OptimizerRequest): Promise<unknown> {
  const response = await fetch(`${env.OPTIMIZER_URL}/2015-03-31/functions/function/invocations`, {
    method: "POST",
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new AppError("OPTIMIZATION_FAILED", 502, "最適化サービスの呼び出しに失敗しました");
  }
  return response.json();
}

async function invokeViaLambda(request: OptimizerRequest, functionName: string): Promise<unknown> {
  const { InvokeCommand, LambdaClient } = await import("@aws-sdk/client-lambda");
  const client = new LambdaClient({});
  const result = await client.send(
    new InvokeCommand({
      FunctionName: functionName,
      Payload: JSON.stringify(request),
    }),
  );
  if (!result.Payload) {
    throw new AppError("OPTIMIZATION_FAILED", 502, "最適化サービスから応答がありません");
  }
  return JSON.parse(new TextDecoder().decode(result.Payload));
}

export async function invokeOptimizer(request: OptimizerRequest): Promise<OptimizerResponse> {
  let raw: unknown;
  try {
    raw = env.OPTIMIZER_FUNCTION_NAME
      ? await invokeViaLambda(request, env.OPTIMIZER_FUNCTION_NAME)
      : await invokeViaHttp(request);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("OPTIMIZATION_FAILED", 502, "最適化サービスに接続できません");
  }

  const parsed = optimizerResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("OPTIMIZATION_FAILED", 502, "最適化サービスの応答形式が不正です");
  }
  return parsed.data;
}

export type OptimizerInvoker = typeof invokeOptimizer;
