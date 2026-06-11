import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";

import { env } from "../env";
import { notFound, onError } from "./errors";
import type { AppEnv } from "./types";

/** モジュール用のルーターを作る。defaultHook で Zod 検証エラーの形式を統一する */
export function createRouter() {
  return new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR" as const,
              message: "入力値が正しくありません",
              issues: result.error.issues,
            },
          },
          422,
        );
      }
    },
  });
}

/** アプリ本体を作る（app.ts からのみ呼ぶ） */
export function createApp() {
  const app = createRouter();
  // Web（ブラウザ）からのクロスオリジン呼び出しを許可する。許可先は環境変数で管理
  const allowedOrigins = env.CORS_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim());
  app.use(
    "*",
    cors({
      origin: allowedOrigins,
      allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Authorization", "Content-Type"],
      maxAge: 600,
    }),
  );
  app.notFound(notFound);
  app.onError(onError);
  return app;
}
