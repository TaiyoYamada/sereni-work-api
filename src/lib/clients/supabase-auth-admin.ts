import { z } from "zod";

import { env } from "../../env";
import { AppError, ConflictError } from "../errors";

/**
 * Supabase Auth（GoTrue）Admin API のクライアント（docs/account-provisioning.md）。
 * service role key を使うためサーバー専用。キー・パスワードは絶対にログへ出さない。
 */

export type SupabaseAuthAdmin = {
  /** 招待メールを送信して auth ユーザーを作成する。未確認ユーザーへの再実行は再送として動作する */
  inviteUserByEmail(email: string): Promise<{ id: string }>;
  /** メール確認済みの auth ユーザーをパスワード付きで作成する（利用者の初期パスワード発行用） */
  createUser(input: { email: string; password: string }): Promise<{ id: string }>;
  /** パスワードを再設定する（初期パスワード再発行用） */
  updateUserPassword(authUserId: string, password: string): Promise<void>;
};

const authUserSchema = z.object({ id: z.uuid() });

function adminHeaders(): Record<string, string> {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new AppError("INTERNAL_ERROR", 500, "アカウント発行機能が設定されていません");
  }
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function requestAuthAdmin(path: string, init: { method: string; body: unknown }) {
  let response: Response;
  try {
    response = await fetch(`${env.SUPABASE_URL}/auth/v1${path}`, {
      method: init.method,
      headers: adminHeaders(),
      body: JSON.stringify(init.body),
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("INTERNAL_ERROR", 502, "認証サービスに接続できません");
  }

  // GoTrue は重複メール等を 422 で返す
  if (response.status === 422) {
    throw new ConflictError("このメールアドレスは既に認証アカウントとして登録されています");
  }
  if (!response.ok) {
    throw new AppError("INTERNAL_ERROR", 502, "認証サービスの呼び出しに失敗しました");
  }
  return response.json();
}

export const supabaseAuthAdmin: SupabaseAuthAdmin = {
  async inviteUserByEmail(email) {
    const raw = await requestAuthAdmin("/invite", { method: "POST", body: { email } });
    const parsed = authUserSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError("INTERNAL_ERROR", 502, "認証サービスの応答形式が不正です");
    }
    return parsed.data;
  },

  async createUser({ email, password }) {
    const raw = await requestAuthAdmin("/admin/users", {
      method: "POST",
      body: { email, password, email_confirm: true },
    });
    const parsed = authUserSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError("INTERNAL_ERROR", 502, "認証サービスの応答形式が不正です");
    }
    return parsed.data;
  },

  async updateUserPassword(authUserId, password) {
    await requestAuthAdmin(`/admin/users/${authUserId}`, { method: "PUT", body: { password } });
  },
};
