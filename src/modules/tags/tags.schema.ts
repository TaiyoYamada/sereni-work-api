import { z } from "@hono/zod-openapi";

/** タグ入力のサジェスト候補（登録済みデータから頻度順に集計） */
export const tagSuggestionsResponseSchema = z
  .object({
    occupations: z.array(z.string()),
    skills: z.array(z.string()),
    accommodations: z.array(z.string()),
  })
  .openapi("TagSuggestions");

export type TagSuggestionsResponse = z.infer<typeof tagSuggestionsResponseSchema>;
