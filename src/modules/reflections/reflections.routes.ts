import { createRoute, z } from "@hono/zod-openapi";

import { errorResponses } from "../../lib/schemas";
import { authenticate } from "../../middleware/auth";
import { requireRole, requireStaff } from "../../middleware/require-role";
import {
  createReflectionSchema,
  reflectionIdParamSchema,
  reflectionParticipantParamSchema,
  reflectionResponseSchema,
  updateReflectionSchema,
} from "./reflections.schema";

const tags = ["reflections"];

export const list = createRoute({
  method: "get",
  path: "/participants/{participantId}/reflections",
  tags,
  summary: "利用者の1対1振り返り記録一覧（面談日の新しい順）",
  middleware: [authenticate(), requireStaff()] as const,
  request: { params: reflectionParticipantParamSchema },
  responses: {
    200: {
      description: "振り返り記録一覧",
      content: { "application/json": { schema: z.array(reflectionResponseSchema) } },
    },
    ...errorResponses(401, 403, 404),
  },
});

export const create = createRoute({
  method: "post",
  path: "/reflections",
  tags,
  summary: "1対1振り返り記録の作成",
  middleware: [authenticate(), requireRole("admin", "staff")] as const,
  request: {
    body: { content: { "application/json": { schema: createReflectionSchema } }, required: true },
  },
  responses: {
    201: {
      description: "作成した振り返り記録",
      content: { "application/json": { schema: reflectionResponseSchema } },
    },
    ...errorResponses(401, 403, 404, 422),
  },
});

export const update = createRoute({
  method: "patch",
  path: "/reflections/{id}",
  tags,
  summary: "1対1振り返り記録の更新（記録者本人または管理者）",
  middleware: [authenticate(), requireRole("admin", "staff")] as const,
  request: {
    params: reflectionIdParamSchema,
    body: { content: { "application/json": { schema: updateReflectionSchema } }, required: true },
  },
  responses: {
    200: {
      description: "更新した振り返り記録",
      content: { "application/json": { schema: reflectionResponseSchema } },
    },
    ...errorResponses(401, 403, 404, 422),
  },
});

export const remove = createRoute({
  method: "delete",
  path: "/reflections/{id}",
  tags,
  summary: "1対1振り返り記録の削除（記録者本人または管理者）",
  middleware: [authenticate(), requireRole("admin", "staff")] as const,
  request: { params: reflectionIdParamSchema },
  responses: {
    204: { description: "削除完了" },
    ...errorResponses(401, 403, 404),
  },
});
