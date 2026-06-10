import { createRoute, z } from "@hono/zod-openapi";

import { errorResponses } from "../../lib/schemas";
import { authenticate } from "../../middleware/auth";
import { requireRole, requireStaff } from "../../middleware/require-role";
import {
  evaluationResponseSchema,
  listEvaluationsQuerySchema,
  upsertEvaluationSchema,
} from "./evaluations.schema";

const tags = ["evaluations"];

export const list = createRoute({
  method: "get",
  path: "/evaluations",
  tags,
  summary: "支援員評価一覧（割当単位）",
  middleware: [authenticate(), requireStaff()] as const,
  request: { query: listEvaluationsQuerySchema },
  responses: {
    200: {
      description: "評価一覧",
      content: { "application/json": { schema: z.array(evaluationResponseSchema) } },
    },
    ...errorResponses(401, 403, 404),
  },
});

export const upsert = createRoute({
  method: "put",
  path: "/evaluations",
  tags,
  summary: "自分の評価の登録・更新（割当×支援員でユニーク。再送信は上書き）",
  middleware: [authenticate(), requireRole("admin", "staff")] as const,
  request: {
    body: { content: { "application/json": { schema: upsertEvaluationSchema } }, required: true },
  },
  responses: {
    200: {
      description: "保存した評価",
      content: { "application/json": { schema: evaluationResponseSchema } },
    },
    ...errorResponses(401, 403, 404, 409, 422),
  },
});
