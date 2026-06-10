import { createRoute } from "@hono/zod-openapi";

import { errorResponses, idParamSchema, paginatedSchema } from "../../lib/schemas";
import { authenticate } from "../../middleware/auth";
import { requireRole, requireStaff } from "../../middleware/require-role";
import {
  companyResponseSchema,
  createCompanySchema,
  listCompaniesQuerySchema,
  updateCompanySchema,
} from "./companies.schema";

const tags = ["companies"];

export const list = createRoute({
  method: "get",
  path: "/companies",
  tags,
  summary: "実習先企業一覧",
  middleware: [authenticate(), requireStaff()] as const,
  request: { query: listCompaniesQuerySchema },
  responses: {
    200: {
      description: "企業一覧",
      content: { "application/json": { schema: paginatedSchema(companyResponseSchema) } },
    },
    ...errorResponses(401, 403),
  },
});

export const getOne = createRoute({
  method: "get",
  path: "/companies/{id}",
  tags,
  summary: "実習先企業詳細",
  middleware: [authenticate(), requireStaff()] as const,
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "企業詳細",
      content: { "application/json": { schema: companyResponseSchema } },
    },
    ...errorResponses(401, 403, 404),
  },
});

export const create = createRoute({
  method: "post",
  path: "/companies",
  tags,
  summary: "実習先企業登録（管理者のみ）",
  middleware: [authenticate(), requireRole("admin")] as const,
  request: {
    body: { content: { "application/json": { schema: createCompanySchema } }, required: true },
  },
  responses: {
    201: {
      description: "登録した企業",
      content: { "application/json": { schema: companyResponseSchema } },
    },
    ...errorResponses(401, 403, 422),
  },
});

export const patch = createRoute({
  method: "patch",
  path: "/companies/{id}",
  tags,
  summary: "実習先企業更新（管理者のみ）",
  middleware: [authenticate(), requireRole("admin")] as const,
  request: {
    params: idParamSchema,
    body: { content: { "application/json": { schema: updateCompanySchema } }, required: true },
  },
  responses: {
    200: {
      description: "更新後の企業",
      content: { "application/json": { schema: companyResponseSchema } },
    },
    ...errorResponses(401, 403, 404, 422),
  },
});
