import { createRoute } from "@hono/zod-openapi";

import { errorResponses, idParamSchema, paginatedSchema } from "../../lib/schemas";
import { authenticate } from "../../middleware/auth";
import { requireRole, requireStaff } from "../../middleware/require-role";
import {
  createStaffSchema,
  listStaffQuerySchema,
  staffResponseSchema,
  updateStaffSchema,
} from "./staff.schema";

const tags = ["staff"];

export const list = createRoute({
  method: "get",
  path: "/staff",
  tags,
  summary: "職員一覧（担当割当の選択等に使用）",
  middleware: [authenticate(), requireStaff()] as const,
  request: { query: listStaffQuerySchema },
  responses: {
    200: {
      description: "職員一覧",
      content: { "application/json": { schema: paginatedSchema(staffResponseSchema) } },
    },
    ...errorResponses(401, 403),
  },
});

export const getMe = createRoute({
  method: "get",
  path: "/staff/me",
  tags,
  summary: "自分の職員情報（ログイン中のロール確認用）",
  middleware: [authenticate(), requireStaff()] as const,
  responses: {
    200: {
      description: "自分の職員情報",
      content: { "application/json": { schema: staffResponseSchema } },
    },
    ...errorResponses(401, 403),
  },
});

export const getOne = createRoute({
  method: "get",
  path: "/staff/{id}",
  tags,
  summary: "職員詳細",
  middleware: [authenticate(), requireRole("admin")] as const,
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "職員詳細",
      content: { "application/json": { schema: staffResponseSchema } },
    },
    ...errorResponses(401, 403, 404),
  },
});

export const create = createRoute({
  method: "post",
  path: "/staff",
  tags,
  summary: "職員アカウント作成（管理者のみ）",
  middleware: [authenticate(), requireRole("admin")] as const,
  request: {
    body: { content: { "application/json": { schema: createStaffSchema } }, required: true },
  },
  responses: {
    201: {
      description: "作成した職員",
      content: { "application/json": { schema: staffResponseSchema } },
    },
    ...errorResponses(401, 403, 409, 422),
  },
});

export const patch = createRoute({
  method: "patch",
  path: "/staff/{id}",
  tags,
  summary: "職員更新（ロール変更・アカウント停止。管理者のみ）",
  middleware: [authenticate(), requireRole("admin")] as const,
  request: {
    params: idParamSchema,
    body: { content: { "application/json": { schema: updateStaffSchema } }, required: true },
  },
  responses: {
    200: {
      description: "更新後の職員",
      content: { "application/json": { schema: staffResponseSchema } },
    },
    ...errorResponses(401, 403, 404, 422),
  },
});
