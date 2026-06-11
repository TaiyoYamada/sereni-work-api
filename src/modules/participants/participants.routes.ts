import { createRoute } from "@hono/zod-openapi";

import { errorResponses, idParamSchema, paginatedSchema } from "../../lib/schemas";
import { authenticate } from "../../middleware/auth";
import { requireRole, requireStaff } from "../../middleware/require-role";
import {
  createParticipantSchema,
  listParticipantsQuerySchema,
  participantAccountResponseSchema,
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

export const issueAccount = createRoute({
  method: "post",
  path: "/participants/{id}/account",
  tags,
  summary: "利用者アカウント発行（admin は全員 / staff は担当のみ）",
  description:
    "Supabase Auth ユーザーを作成し、ログイン ID と初期パスワードを返す。初期パスワードはこのレスポンスでのみ取得できる",
  middleware: [authenticate(), requireRole("admin", "staff")] as const,
  request: { params: idParamSchema },
  responses: {
    201: {
      description: "発行したアカウント情報",
      content: { "application/json": { schema: participantAccountResponseSchema } },
    },
    ...errorResponses(401, 403, 404, 409, 502),
  },
});

export const resetAccountPassword = createRoute({
  method: "post",
  path: "/participants/{id}/account/reset-password",
  tags,
  summary: "利用者の初期パスワード再発行（admin は全員 / staff は担当のみ）",
  description: "新しい初期パスワードを生成して返す。このレスポンスでのみ取得できる",
  middleware: [authenticate(), requireRole("admin", "staff")] as const,
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "再発行したアカウント情報",
      content: { "application/json": { schema: participantAccountResponseSchema } },
    },
    ...errorResponses(401, 403, 404, 409, 502),
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
