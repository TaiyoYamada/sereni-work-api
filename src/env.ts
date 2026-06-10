import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3001),
  // DB 実装時に必須化する（z.string().min(1) へ変更）
  DATABASE_URL: z.string().optional(),
});

export const env = envSchema.parse(process.env);
