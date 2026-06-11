# アカウント発行（プロビジョニング）仕様

職員（Web）・利用者（iOS）が実際にログインできるようになるまでの流れを定義する。
DB 登録（staff / participants の行作成）と認証アカウント発行（Supabase Auth ユーザー作成）は**分離**する。

## 背景

- `staff.auth_user_id` / `participants.auth_user_id` は nullable。DB 登録だけではログインできない
- 発行操作によって Supabase Auth ユーザーを作成し、`auth_user_id` を紐付けることで初めてログイン可能になる
- 発行方式は対象者で異なる:
  - **職員** — 招待メール（リンクからパスワードを自分で設定）
  - **利用者** — 初期パスワード発行（支援員が手渡し。メールを持たない利用者がいる前提）

## アカウント状態

`auth_user_id` の有無から導出する（専用カラムは持たない = SSOT）。

| 状態 | 条件 | 表示 |
| --- | --- | --- |
| 未発行 | `auth_user_id IS NULL` | 「アカウント未発行」 |
| 発行済み | `auth_user_id IS NOT NULL` | 「アカウント発行済み」 |

## ログイン ID（利用者）

- 実メールアドレスがある利用者はそれをログイン ID とする
- メールを持たない利用者には発行時にシステム生成 ID（`p-{短いランダム英数}@id.sereni.local` 形式）を自動生成する
- 発行時に使ったログイン ID は（実メール・生成 ID を問わず）`participants.login_id`（text, unique, nullable）へ保存し、Web の利用者詳細に常時表示する。連絡先の email を後から変更してもログイン ID は変わらないため、別カラムで持つ
- iOS のログイン画面は「メールアドレス」ではなく「**ログイン ID**」と表記する

## API

### 職員: 招待メール

```
POST /staff/{id}/invite        （admin のみ）
```

1. 対象職員が未発行であることを確認（発行済みかつ初回ログイン済みなら `CONFLICT`）
2. Supabase Admin API `inviteUserByEmail(email)` で auth ユーザー作成 + 招待メール送信
3. 返却された user id を `staff.auth_user_id` に保存
4. 招待済み・未ログインの職員に対しては**再送**として動作する（invite リンク再生成）
5. 監査ログ: `STAFF_INVITE`

### 利用者: 初期パスワード発行

```
POST /participants/{id}/account                 （admin / 担当 staff）
POST /participants/{id}/account/reset-password  （admin / 担当 staff）
```

発行（`/account`）:

1. 未発行であることを確認（発行済みなら `CONFLICT`）
2. ログイン ID を決定（実メール or システム生成 → `login_id` 保存）
3. 初期パスワードを生成（16 文字以上のランダム文字列、紛らわしい文字を除外）
4. Supabase Admin API `createUser({ email, password, email_confirm: true })`
5. `participants.auth_user_id` に紐付け
6. レスポンスで `{ loginId, initialPassword }` を**一度だけ**返す。以後 API から初期パスワードは取得不可
7. 監査ログ: `PARTICIPANT_ACCOUNT_ISSUE`（**パスワードは記録しない**）

再発行（`/reset-password`）:

- 発行済みであることを確認（未発行なら `CONFLICT`）
- 新しいランダムパスワードを生成し Supabase Admin API で更新、`{ loginId, initialPassword }` を一度だけ返す
- 監査ログ: `PARTICIPANT_ACCOUNT_PASSWORD_RESET`

### 認可

| 操作 | admin | staff | viewer |
| --- | --- | --- | --- |
| 職員の招待 | ○ | × | × |
| 利用者のアカウント発行・再発行 | ○（全員） | ○（担当利用者のみ） | × |

担当チェックは `participants.policy.ts` の既存ポリシー（担当利用者のみ編集可）と同じ関数系に集約する。

### 初回ログイン時のパスワード変更

**強制しない。** 利用者の操作負荷を優先し、変更は任意（iOS 設定画面から、将来実装）。
初期パスワードの強度と、担当支援員がいつでも再発行できる運用でカバーする。

## 実装メモ

- Supabase Auth（GoTrue）Admin API クライアントは `lib/clients/supabase-auth-admin.ts`（fetch ベース、依存追加なし）
- 環境変数を追加: `SUPABASE_SERVICE_ROLE_KEY`（`env.ts` で Zod 検証。ローカルは `supabase status` の Secret キー）
- service role key はサーバー（Hono）専用。フロントエンドへ渡さない・ログへ出さない
- マイグレーション: `participants.login_id` の追加のみ

## ブートストラップ（最初の管理者）

- **ローカル開発**: `seed.ts` を拡張し、staff 行の作成と同時に Supabase Admin API で auth ユーザーを作成して紐付ける
  - `admin@example.com` / `sato@example.com`（パスワードは seed 内の固定値）→ シード直後に Web へログイン可能
- **本番**: 初回セットアップスクリプト（`scripts/bootstrap-admin.ts`、引数でメールを受け取り招待を送る）を用意する

## Web UI

- 職員・利用者の詳細画面に「アカウント」カードを設ける: 状態バッジ / ログイン ID / 発行・再送・再発行ボタン
- 利用者の発行・再発行は確認ダイアログ → 結果ダイアログで `loginId` + 初期パスワードを表示（コピー操作付き）
  - 「この画面を閉じると初期パスワードは再表示できません。必要な場合は再発行してください」と明記する
- 一覧にもアカウント状態バッジを表示する
- viewer にはアカウント操作 UI を表示しない（最終判定は API 側）
