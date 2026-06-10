import { OpenAPIHono } from "@hono/zod-openapi";

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
  app.notFound(notFound);
  app.onError(onError);
  return app;
}
