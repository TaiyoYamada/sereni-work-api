# sereni-work-api

セレニワーク 体験実習支援システムのバックエンド API。
職員用 Web（[sereni-work-web](../sereni-work-web)）と利用者用 iOS（[sereni-work-ios](../sereni-work-ios)）の両方がこの API を通じて業務データへアクセスする。Python の割当最適化処理（optimizer）も本リポジトリに含む。

## 技術構成

| 領域 | 技術 |
|---|---|
| API | Hono + TypeScript（AWS Lambda） |
| DB / 認証 / ファイル | Supabase（PostgreSQL / Auth / Storage）+ Drizzle ORM |
| 最適化 | Python + D-Wave Ocean SDK（QUBO / SA / 量子アニーリング実機）。独立した Lambda コンテナ |
| ドキュメント | OpenAPI（`/doc` に自動生成） |

アーキテクチャの詳細は [CLAUDE.md](./CLAUDE.md) と [docs/](./docs/) を参照。

## 必要なもの

- [Bun](https://bun.sh)
- Docker（DB・optimizer の実行に使用）
- [Supabase CLI](https://supabase.com/docs/guides/cli)

## セットアップ

```bash
bun install
cp .env.example .env

# ローカル環境の起動
supabase start                       # PostgreSQL / Auth / Storage（Docker）
bun run db:migrate                   # マイグレーション適用
bun run db:seed                      # 開発用シードデータ
docker compose up --build optimizer  # 最適化 Lambda（ポート 9000）

# API サーバー
bun run dev                          # http://localhost:3001
```

ログインを試すには Supabase Studio（http://localhost:54323）でユーザーを作成し、
その UUID を `staff.auth_user_id` に設定する。

## 開発コマンド

| コマンド | 内容 |
|---|---|
| `bun run dev` | 開発サーバー（--watch） |
| `bun run test` | テスト（`DATABASE_URL` 設定時は実 DB 統合テストも実行） |
| `bun run lint` / `bun run format` | ESLint / Prettier |
| `bun run typecheck` | 型チェック |
| `bun run build` | Lambda 用バンドル（dist/lambda.cjs） |
| `bun run db:generate` / `db:migrate` | Drizzle マイグレーション |

optimizer（`optimizer/` ディレクトリ内）:

```bash
uvx ruff check . && uvx ruff format .   # Lint / Format
uv run --no-project --with pytest pytest # テスト
```

## ディレクトリ構成

```
src/
  app.ts / lambda.ts / local.ts   # アプリ本体と各エントリポイント
  db/                             # Drizzle スキーマ・マイグレーション
  middleware/                     # 認証（JWT）・ロールガード
  lib/                            # 共通基盤（エラー・監査ログ・optimizer クライアント）
  modules/                        # 機能モジュール（participants, assignments, reports, ...）
optimizer/                        # Python 最適化 Lambda（QUBO 生成・ソルバー・検証）
docs/                             # 設計ドキュメント
supabase/                         # Supabase CLI 設定
```

## ライセンス

本リポジトリは私的なソフトウェアです（All rights reserved）。詳細は [LICENSE](./LICENSE) を参照。
