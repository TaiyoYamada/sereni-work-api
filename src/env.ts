import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3001),
  // DB 実装時に必須化する（z.string().min(1) へ変更）
  DATABASE_URL: z.string().optional(),
  // Supabase の URL（JWKS の取得に使用）。デフォルトはローカルの supabase start
  SUPABASE_URL: z.url().default("http://127.0.0.1:54321"),
  // レガシー HS256 トークン用シークレット（テスト・旧構成との互換用）。
  // 通常のトークン検証は SUPABASE_URL の JWKS（ES256 等の非対称鍵）で行う
  SUPABASE_JWT_SECRET: z
    .string()
    .min(32)
    .default("super-secret-jwt-token-with-at-least-32-characters-long"),
  // 最適化 Lambda の呼び出し先。ローカルは RIE（docker compose up optimizer）、
  // 本番は OPTIMIZER_FUNCTION_NAME（AWS SDK で Invoke）を設定する
  OPTIMIZER_URL: z.url().default("http://localhost:9000"),
  OPTIMIZER_FUNCTION_NAME: z.string().optional(),
});

export const env = envSchema.parse(process.env);
