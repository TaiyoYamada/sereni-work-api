import { createRoute } from "@hono/zod-openapi";

import { errorResponses } from "../../lib/schemas";
import { authenticate } from "../../middleware/auth";
import { requireStaff } from "../../middleware/require-role";
import { dashboardResponseSchema } from "./dashboard.schema";

export const getDashboard = createRoute({
  method: "get",
  path: "/dashboard",
  tags: ["dashboard"],
  summary: "ダッシュボード集計（要対応キュー・統計・トレンド）",
  middleware: [authenticate(), requireStaff()] as const,
  responses: {
    200: {
      description: "ダッシュボード集計",
      content: { "application/json": { schema: dashboardResponseSchema } },
    },
    ...errorResponses(401, 403),
  },
});
