import type { OpenAPIHono } from "@hono/zod-openapi";

import type { AppEnv } from "./types";

export function configureOpenAPI(app: OpenAPIHono<AppEnv>) {
  app.doc("/doc", {
    openapi: "3.0.0",
    info: {
      title: "sereni-work API",
      version: "0.1.0",
      description: "セレニワーク体験実習支援システム API",
    },
  });
}
