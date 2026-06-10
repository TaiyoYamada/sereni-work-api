import type { Context, ErrorHandler, NotFoundHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "ASSIGNMENT_CAPACITY_EXCEEDED",
  "OPTIMIZATION_FAILED",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: ContentfulStatusCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "リソースが見つかりません") {
    super("NOT_FOUND", 404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "リソースが競合しています") {
    super("CONFLICT", 409, message);
  }
}

function errorBody(code: ErrorCode, message: string) {
  return { error: { code, message } };
}

export const onError: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json(errorBody(err.code, err.message), err.status);
  }
  // スタックトレース等の内部情報をレスポンスへ含めない
  return c.json(errorBody("INTERNAL_ERROR", "サーバー内部でエラーが発生しました"), 500);
};

export const notFound: NotFoundHandler = (c: Context) =>
  c.json(errorBody("NOT_FOUND", "リソースが見つかりません"), 404);
