import { createRoute } from "@hono/zod-openapi";

import { errorResponses } from "../../lib/schemas";
import { authenticate } from "../../middleware/auth";
import { requireStaff } from "../../middleware/require-role";
import { tagSuggestionsResponseSchema } from "./tags.schema";

export const getSuggestions = createRoute({
  method: "get",
  path: "/tag-suggestions",
  tags: ["tags"],
  summary: "タグ入力のサジェスト候補（希望職種・スキル・配慮事項）",
  middleware: [authenticate(), requireStaff()] as const,
  responses: {
    200: {
      description: "サジェスト候補",
      content: { "application/json": { schema: tagSuggestionsResponseSchema } },
    },
    ...errorResponses(401, 403),
  },
});
