import { createRoute, z } from "@hono/zod-openapi";

export const get = createRoute({
  method: "get",
  path: "/health",
  tags: ["health"],
  responses: {
    200: {
      description: "ヘルスチェック",
      content: {
        "application/json": {
          schema: z.object({ status: z.literal("ok") }),
        },
      },
    },
  },
});
