import { createRoute } from "@hono/zod-openapi";

import { errorResponses, idParamSchema, paginatedSchema } from "../../lib/schemas";
import { authenticate } from "../../middleware/auth";
import { requireRole, requireStaff } from "../../middleware/require-role";
import {
  assignmentResponseSchema,
  cancelAssignmentSchema,
  createAssignmentSchema,
  listAssignmentsQuerySchema,
  updateAssignmentSchema,
} from "./assignments.schema";

const tags = ["assignments"];

const assignmentJson = {
  description: "実習割当",
  content: { "application/json": { schema: assignmentResponseSchema } },
};

export const list = createRoute({
  method: "get",
  path: "/assignments",
  tags,
  summary: "実習割当一覧（利用者別・企業別・状態・期間でフィルタ）",
  middleware: [authenticate(), requireStaff()] as const,
  request: { query: listAssignmentsQuerySchema },
  responses: {
    200: {
      description: "割当一覧",
      content: { "application/json": { schema: paginatedSchema(assignmentResponseSchema) } },
    },
    ...errorResponses(401, 403),
  },
});

export const getOne = createRoute({
  method: "get",
  path: "/assignments/{id}",
  tags,
  summary: "実習割当詳細",
  middleware: [authenticate(), requireStaff()] as const,
  request: { params: idParamSchema },
  responses: { 200: assignmentJson, ...errorResponses(401, 403, 404) },
});

export const create = createRoute({
  method: "post",
  path: "/assignments",
  tags,
  summary: "実習割当の作成（下書きとして作成される）",
  middleware: [authenticate(), requireRole("admin", "staff")] as const,
  request: {
    body: { content: { "application/json": { schema: createAssignmentSchema } }, required: true },
  },
  responses: { 201: assignmentJson, ...errorResponses(401, 403, 404, 409, 422) },
});

export const patch = createRoute({
  method: "patch",
  path: "/assignments/{id}",
  tags,
  summary: "実習割当の編集（下書き・提案中のみ）",
  middleware: [authenticate(), requireRole("admin", "staff")] as const,
  request: {
    params: idParamSchema,
    body: { content: { "application/json": { schema: updateAssignmentSchema } }, required: true },
  },
  responses: { 200: assignmentJson, ...errorResponses(401, 403, 404, 409, 422) },
});

export const confirm = createRoute({
  method: "post",
  path: "/assignments/{id}/confirm",
  tags,
  summary: "割当確定（管理者のみ。定員・期間重複を検証）",
  middleware: [authenticate(), requireRole("admin")] as const,
  request: { params: idParamSchema },
  responses: { 200: assignmentJson, ...errorResponses(401, 403, 404, 409) },
});

export const start = createRoute({
  method: "post",
  path: "/assignments/{id}/start",
  tags,
  summary: "実習開始（確定済み → 実習中）",
  middleware: [authenticate(), requireRole("admin", "staff")] as const,
  request: { params: idParamSchema },
  responses: { 200: assignmentJson, ...errorResponses(401, 403, 404, 409) },
});

export const complete = createRoute({
  method: "post",
  path: "/assignments/{id}/complete",
  tags,
  summary: "実習完了（実習中 → 完了）",
  middleware: [authenticate(), requireRole("admin", "staff")] as const,
  request: { params: idParamSchema },
  responses: { 200: assignmentJson, ...errorResponses(401, 403, 404, 409) },
});

export const cancel = createRoute({
  method: "post",
  path: "/assignments/{id}/cancel",
  tags,
  summary: "実習中止（理由必須）",
  middleware: [authenticate(), requireRole("admin", "staff")] as const,
  request: {
    params: idParamSchema,
    body: { content: { "application/json": { schema: cancelAssignmentSchema } }, required: true },
  },
  responses: { 200: assignmentJson, ...errorResponses(401, 403, 404, 409, 422) },
});
