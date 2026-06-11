import { z } from "@hono/zod-openapi";

/** パスパラメータの UUID */
export const idParamSchema = z.object({
  id: z.uuid().openapi({ param: { name: "id", in: "path" }, example: crypto.randomUUID() }),
});

/** 一覧系クエリの共通ページネーション */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
  perPage: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** 一覧の並び順（sort キーは各モジュールでホワイトリスト定義する） */
export const sortOrderSchema = z.enum(["asc", "desc"]);

export type SortOrder = z.infer<typeof sortOrderSchema>;

/** 一覧レスポンスのメタ情報 */
export const paginationMetaSchema = z.object({
  page: z.number().int(),
  perPage: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

export function paginatedSchema<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    meta: paginationMetaSchema,
  });
}

export function paginationMeta(query: PaginationQuery, total: number) {
  return {
    page: query.page,
    perPage: query.perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.perPage)),
  };
}

/** 統一エラーレスポンス */
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string().openapi({ example: "NOT_FOUND" }),
    message: z.string(),
  }),
});

/** createRoute の responses に共通エラーを足すヘルパー */
export function errorResponses(...statuses: number[]) {
  return Object.fromEntries(
    statuses.map((status) => [
      status,
      {
        description: "エラー",
        content: { "application/json": { schema: errorResponseSchema } },
      },
    ]),
  );
}
