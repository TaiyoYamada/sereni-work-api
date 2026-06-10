import { createRoute } from "@hono/zod-openapi";

import { errorResponses, idParamSchema, paginatedSchema } from "../../lib/schemas";
import { authenticate } from "../../middleware/auth";
import { requireRole, requireStaff } from "../../middleware/require-role";
import {
  createParticipantSchema,
  listParticipantsQuerySchema,
  participantResponseSchema,
  updateParticipantSchema,
} from "./participants.schema";

const tags = ["participants"];

export const list = createRoute({
  method: "get",
  path: "/participants",
  tags,
  summary: "利用者一覧",
  middleware: [authenticate(), requireStaff()] as const,
  request: { query: listParticipantsQuerySchema },
  responses: {
    200: {
      description: "利用者一覧",
      content: {
        "application/json": { schema: paginatedSchema(participantResponseSchema) },
      },
    },
    ...errorResponses(401, 403),
  },
});

export const getOne = createRoute({
  method: "get",
  path: "/participants/{id}",
  tags,
  summary: "利用者詳細",
  middleware: [authenticate(), requireStaff()] as const,
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "利用者詳細",
      content: { "application/json": { schema: participantResponseSchema } },
    },
    ...errorResponses(401, 403, 404),
  },
});

export const create = createRoute({
  method: "post",
  path: "/participants",
  tags,
  summary: "利用者登録（管理者のみ）",
  middleware: [authenticate(), requireRole("admin")] as const,
  request: {
    body: {
      content: { "application/json": { schema: createParticipantSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      description: "登録した利用者",
      content: { "application/json": { schema: participantResponseSchema } },
    },
    ...errorResponses(401, 403, 422),
  },
});

export const patch = createRoute({
  method: "patch",
  path: "/participants/{id}",
  tags,
  summary: "利用者更新（admin は全員 / staff は担当のみ）",
  middleware: [authenticate(), requireRole("admin", "staff")] as const,
  request: {
    params: idParamSchema,
    body: {
      content: { "application/json": { schema: updateParticipantSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "更新後の利用者",
      content: { "application/json": { schema: participantResponseSchema } },
    },
    ...errorResponses(401, 403, 404, 422),
  },
});
