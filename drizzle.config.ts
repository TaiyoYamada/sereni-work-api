import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // ローカルは supabase start が公開する 54322 番ポート
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:54322/postgres",
  },
});
