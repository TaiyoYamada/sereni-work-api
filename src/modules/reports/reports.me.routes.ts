import { createRoute, z } from "@hono/zod-openapi";

import { errorResponses, paginatedSchema, paginationQuerySchema } from "../../lib/schemas";
import { authenticate } from "../../middleware/auth";
import { requireParticipant } from "../../middleware/require-role";
import {
  preCheckResponseSchema,
  reportResponseSchema,
  submitMyPreCheckSchema,
  submitMyReportSchema,
} from "./reports.schema";

const tags = ["me"];

export const listMine = createRoute({
  method: "get",
  path: "/me/reports",
  tags,
  summary: "自分の日報一覧（iOS）",
  middleware: [authenticate(), requireParticipant()] as const,
  request: { query: paginationQuerySchema },
  responses: {
    200: {
      description: "自分の日報一覧",
      content: { "application/json": { schema: paginatedSchema(reportResponseSchema) } },
    },
    ...errorResponses(401, 403),
  },
});

export const submitMine = createRoute({
  method: "post",
  path: "/me/reports",
  tags,
  summary: "日報の提出（clientGeneratedId で冪等。再送は 200 で既存を返す）",
  middleware: [authenticate(), requireParticipant()] as const,
  request: {
    body: { content: { "application/json": { schema: submitMyReportSchema } }, required: true },
  },
  responses: {
    201: {
      description: "提出した日報",
      content: { "application/json": { schema: reportResponseSchema } },
    },
    200: {
      description: "再送（既存の日報を返す）",
      content: { "application/json": { schema: reportResponseSchema } },
    },
    ...errorResponses(401, 403, 404, 409, 422),
  },
});

export const submitPreCheck = createRoute({
  method: "put",
  path: "/me/pre-checks",
  tags,
  summary: "実習前チェックの提出（同日2回目は上書き）",
  middleware: [authenticate(), requireParticipant()] as const,
  request: {
    body: { content: { "application/json": { schema: submitMyPreCheckSchema } }, required: true },
  },
  responses: {
    200: {
      description: "保存した実習前チェック",
      content: { "application/json": { schema: preCheckResponseSchema } },
    },
    ...errorResponses(401, 403, 404, 409, 422),
  },
});

export const profileResponseSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    preferredLanguage: z.string(),
  })
  .openapi("MyProfile");

export const profile = createRoute({
  method: "get",
  path: "/me/profile",
  tags,
  summary: "自分のプロフィール（iOS の表示名・言語設定）",
  middleware: [authenticate(), requireParticipant()] as const,
  responses: {
    200: {
      description: "自分のプロフィール",
      content: { "application/json": { schema: profileResponseSchema } },
    },
    ...errorResponses(401, 403),
  },
});
