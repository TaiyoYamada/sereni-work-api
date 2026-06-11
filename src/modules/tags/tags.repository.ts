import { sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../db/client";
import type { TagSuggestionsResponse } from "./tags.schema";

/** サジェストの最大件数（datalist で扱いやすい範囲に抑える） */
const SUGGESTION_LIMIT = 50;

const tagRowSchema = z.object({ tag: z.string() });

async function topTags(source: ReturnType<typeof sql>): Promise<string[]> {
  const rows = await db.execute(sql`
    select tag from (${source}) tags
    where tag <> ''
    group by tag
    order by count(*) desc, tag
    limit ${SUGGESTION_LIMIT}
  `);
  return z
    .array(tagRowSchema)
    .parse(rows)
    .map((row) => row.tag);
}

export const tagsRepository = {
  /** 利用者・企業の登録済みタグを種類別に頻度順で返す */
  async suggestions(): Promise<TagSuggestionsResponse> {
    const [occupations, skills, accommodations] = await Promise.all([
      topTags(sql`select unnest(desired_occupations) as tag from participants`),
      topTags(sql`
        select unnest(skills) as tag from participants
        union all
        select unnest(required_skills) as tag from companies
      `),
      topTags(sql`
        select unnest(accommodations) as tag from participants
        union all
        select unnest(supported_accommodations) as tag from companies
      `),
    ]);
    return { occupations, skills, accommodations };
  },
};

export type TagsRepository = typeof tagsRepository;
