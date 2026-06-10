import { createRoute } from "@hono/zod-openapi";

import { errorResponses, idParamSchema, paginatedSchema } from "../../lib/schemas";
import { authenticate } from "../../middleware/auth";
import { requireRole, requireStaff } from "../../middleware/require-role";
import {
  adoptCandidateSchema,
  createRunSchema,
  listRunsQuerySchema,
  runResponseSchema,
} from "./optimization.schema";

const tags = ["optimization"];

const runJson = {
  description: "最適化実行",
  content: { "application/json": { schema: runResponseSchema } },
};

export const create = createRoute({
  method: "post",
  path: "/optimization-runs",
  tags,
  summary: "割当の自動提案を実行（実機 dwave は管理者のみ）",
  middleware: [authenticate(), requireRole("admin", "staff")] as const,
  request: {
    body: { content: { "application/json": { schema: createRunSchema } }, required: true },
  },
  responses: { 201: runJson, ...errorResponses(401, 403, 404, 409, 422, 502) },
});

export const list = createRoute({
  method: "get",
  path: "/optimization-runs",
  tags,
  summary: "最適化実行履歴",
  middleware: [authenticate(), requireStaff()] as const,
  request: { query: listRunsQuerySchema },
  responses: {
    200: {
      description: "実行履歴一覧",
      content: { "application/json": { schema: paginatedSchema(runResponseSchema) } },
    },
    ...errorResponses(401, 403),
  },
});

export const getOne = createRoute({
  method: "get",
  path: "/optimization-runs/{id}",
  tags,
  summary: "最適化実行の詳細（候補・スコア内訳・提案理由）",
  middleware: [authenticate(), requireStaff()] as const,
  request: { params: idParamSchema },
  responses: { 200: runJson, ...errorResponses(401, 403, 404) },
});

export const adopt = createRoute({
  method: "post",
  path: "/optimization-runs/{id}/adopt",
  tags,
  summary: "候補の採用（割当を提案中として作成。確定は割当の confirm で行う）",
  middleware: [authenticate(), requireRole("admin", "staff")] as const,
  request: {
    params: idParamSchema,
    body: { content: { "application/json": { schema: adoptCandidateSchema } }, required: true },
  },
  responses: { 200: runJson, ...errorResponses(401, 403, 404, 409, 422) },
});
