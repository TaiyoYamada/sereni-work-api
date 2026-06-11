/**
 * アカウント発行用の認証情報生成（docs/account-provisioning.md）。
 * 生成値はレスポンスで一度だけ返し、ログ・監査ログへは出力しない。
 */

/** 紛らわしい文字（0/O/1/l/I 等）を除いた文字集合 */
const PASSWORD_CHARSET = "abcdefghjkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789";
const INITIAL_PASSWORD_LENGTH = 16;

const LOGIN_ID_CHARSET = "abcdefghjkmnpqrstuvwxyz23456789";
const LOGIN_ID_RANDOM_LENGTH = 8;
/** システム生成ログイン ID のドメイン部。実在メールと衝突しない予約 TLD（.local）を使う */
const LOGIN_ID_DOMAIN = "id.sereni.local";

function randomString(charset: string, length: number): string {
  const indices = crypto.getRandomValues(new Uint32Array(length));
  return [...indices].map((value) => charset[value % charset.length]).join("");
}

/** 利用者へ手渡す初期パスワードを生成する */
export function generateInitialPassword(): string {
  return randomString(PASSWORD_CHARSET, INITIAL_PASSWORD_LENGTH);
}

/** 実メールを持たない利用者向けのログイン ID（メール形式）を生成する */
export function generateLoginId(): string {
  return `p-${randomString(LOGIN_ID_CHARSET, LOGIN_ID_RANDOM_LENGTH)}@${LOGIN_ID_DOMAIN}`;
}
