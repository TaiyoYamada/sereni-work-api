import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "../env";
import * as schema from "./schema";

// ローカルは supabase start が公開する PostgreSQL（ポート 54322）
const connectionString =
  env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:54322/postgres";

// Lambda のコンテナ再利用を活かすためモジュールスコープで生成する。
// Supabase の transaction pooler は prepared statements 非対応のため prepare: false。
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
export type Database = typeof db;
