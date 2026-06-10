import { createRoute } from "@hono/zod-openapi";

import { errorResponses, idParamSchema, paginatedSchema } from "../../lib/schemas";
import { authenticate } from "../../middleware/auth";
import { requireRole, requireStaff } from "../../middleware/require-role";
import {
  createCommentSchema,
  listReportsQuerySchema,
  reportCommentResponseSchema,
  reportDetailResponseSchema,
  reportResponseSchema,
  reviewReportSchema,
  reviseReportSchema,
} from "./reports.schema";

const tags = ["reports"];

export const list = createRoute({
  method: "get",
  path: "/reports",
  tags,
  summary: "日報一覧（状態・利用者・期間・面談要否でフィルタ）",
  middleware: [authenticate(), requireStaff()] as const,
  request: { query: listReportsQuerySchema },
  responses: {
    200: {
      description: "日報一覧",
      content: { "application/json": { schema: paginatedSchema(reportResponseSchema) } },
    },
    ...errorResponses(401, 403),
  },
});

export const getOne = createRoute({
  method: "get",
  path: "/reports/{id}",
  tags,
  summary: "日報詳細（支援員コメントを含む）",
  middleware: [authenticate(), requireStaff()] as const,
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "日報詳細",
      content: { "application/json": { schema: reportDetailResponseSchema } },
    },
    ...errorResponses(401, 403, 404),
  },
});

export const review = createRoute({
  method: "post",
  path: "/reports/{id}/review",
  tags,
  summary: "日報の確認（確認済み / 要対応 + 面談フラグ）",
  middleware: [authenticate(), requireRole("admin", "staff")] as const,
  request: {
    params: idParamSchema,
    body: { content: { "application/json": { schema: reviewReportSchema } }, required: true },
  },
  responses: {
    200: {
      description: "確認後の日報",
      content: { "application/json": { schema: reportResponseSchema } },
    },
    ...errorResponses(401, 403, 404, 409, 422),
  },
});

export const revise = createRoute({
  method: "post",
  path: "/reports/{id}/revise",
  tags,
  summary: "日報の修正（修正前の内容・修正者・理由を修正履歴に保存）",
  middleware: [authenticate(), requireRole("admin", "staff")] as const,
  request: {
    params: idParamSchema,
    body: { content: { "application/json": { schema: reviseReportSchema } }, required: true },
  },
  responses: {
    200: {
      description: "修正後の日報",
      content: { "application/json": { schema: reportResponseSchema } },
    },
    ...errorResponses(401, 403, 404, 409, 422),
  },
});

export const addComment = createRoute({
  method: "post",
  path: "/reports/{id}/comments",
  tags,
  summary: "日報への支援員コメント",
  middleware: [authenticate(), requireRole("admin", "staff")] as const,
  request: {
    params: idParamSchema,
    body: { content: { "application/json": { schema: createCommentSchema } }, required: true },
  },
  responses: {
    201: {
      description: "作成したコメント",
      content: { "application/json": { schema: reportCommentResponseSchema } },
    },
    ...errorResponses(401, 403, 404, 409, 422),
  },
});
