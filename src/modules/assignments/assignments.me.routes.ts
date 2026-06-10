import { createRoute, z } from "@hono/zod-openapi";

import { errorResponses, paginatedSchema, paginationQuerySchema } from "../../lib/schemas";
import { authenticate } from "../../middleware/auth";
import { requireParticipant } from "../../middleware/require-role";
import { assignmentResponseSchema } from "./assignments.schema";

const tags = ["me"];

export const todayCompanyInfoSchema = z
  .object({
    workHours: z.string().nullable(),
    address: z.string().nullable(),
    belongings: z.string().nullable(),
    emergencyContact: z.string().nullable(),
    contactName: z.string().nullable(),
    contactPhone: z.string().nullable(),
  })
  .openapi("TodayCompanyInfo");

export const meTodayResponseSchema = z
  .object({
    today: z
      .object({
        assignment: assignmentResponseSchema,
        company: todayCompanyInfoSchema,
      })
      .nullable(),
  })
  .openapi("MeToday");

export const today = createRoute({
  method: "get",
  path: "/me/today",
  tags,
  summary: "今日の実習予定（iOS ホーム画面。実習がない日は today: null）",
  middleware: [authenticate(), requireParticipant()] as const,
  responses: {
    200: {
      description: "今日の実習予定",
      content: { "application/json": { schema: meTodayResponseSchema } },
    },
    ...errorResponses(401, 403),
  },
});

export const listMine = createRoute({
  method: "get",
  path: "/me/assignments",
  tags,
  summary: "自分の実習一覧（iOS 進捗画面）",
  middleware: [authenticate(), requireParticipant()] as const,
  request: { query: paginationQuerySchema },
  responses: {
    200: {
      description: "自分の実習一覧",
      content: { "application/json": { schema: paginatedSchema(assignmentResponseSchema) } },
    },
    ...errorResponses(401, 403),
  },
});
