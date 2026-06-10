# sereni-work-api

セレニワーク（就労移行支援事業所）の体験実習支援システムのメインバックエンド API。
Web アプリ（支援員・管理者用）と iOS アプリ（利用者用）の両方がこの API を通じて業務データへアクセスする。
Python の最適化処理（optimizer）もこのリポジトリに含む。

## プロジェクト概要

- 利用者情報・実習先企業・実習割当・日報・支援員評価・教材・通知を一元管理する
- 体験実習先の割当候補を最適化（量子アニーリング / シミュレーテッドアニーリング等）で自動提案する
- 最適化結果は候補であり最終決定ではない。確定は必ず支援員・管理者の操作で行う（人間中心の意思決定支援）
- 業務ルールと最終的な認可判定はすべてこの API 側で行う。フロントエンド（Web / iOS）には持たせない

## プログラミング原則

全コードに適用する普遍原則と TypeScript 規約。違反する場合は理由をコメントかコミットメッセージに残す。

@docs/programming-principles.md

## 技術構成

- Hono + TypeScript
- AWS Lambda（デプロイ先）
- Drizzle ORM
- Zod（入力値検証）
- PostgreSQL（Supabase）
- 認証: Supabase Auth（JWT）
- ファイル: Supabase Storage
- 最適化処理（optimizer/）: Python + D-Wave Ocean SDK のみ（dimod の QUBO 定式化 / SA（既定）/ ExactSolver / 実機）。別の AWS Lambda（コンテナ、Amazon ECR）としてデプロイし、Hono 側から呼び出す

## 開発コマンド・ローカル環境

Docker 化するのは DB と optimizer のみ。Hono はホストで dev サーバーを実行する（ホットリロード優先）。

- DB / Auth / Storage: `supabase start`（Supabase CLI が Docker でローカル一式を起動。停止は `supabase stop`）
- optimizer 起動: `docker compose up --build optimizer`
  - 動作確認: `curl -XPOST http://localhost:9000/2015-03-31/functions/function/invocations -d '{}'`（Lambda Runtime Interface Emulator 経由）

Hono（パッケージマネージャーは bun）:

- `bun run dev` — ローカルサーバー（ポート 3001、--watch 付き）
- `bun run lint` / `bun run format` / `bun run format:check` / `bun run typecheck`
- `bun run test` / `bun run test:watch` — Vitest
- `bun run build` — esbuild で Lambda バンドル（dist/lambda.cjs）
- `bun run db:generate` / `bun run db:migrate` — Drizzle マイグレーション

optimizer（optimizer/ ディレクトリで実行）:

- `uvx ruff check .` / `uvx ruff format .` — Lint / Format
- `uv run --no-project --with pytest pytest` — テスト

## Git 運用

- コミットは Conventional Commits + 日本語本文（例: `feat: 日報提出APIを追加`）
- 接頭辞: feat / fix / refactor / docs / test / chore
- ブランチ: `feature/xxx` `fix/xxx`。main へ直接コミットしない

## ドキュメント

詳細仕様は必要になったときに docs/ を読む:

- `docs/architecture.md` — 通信構成・モジュール構成・最適化処理の流れ
- `docs/api-design.md` — 業務エンドポイント・エラーコード一覧
- `docs/database.md` — データの正本・状態遷移・翻訳・最適化実行履歴の保存項目
- `docs/permissions.md` — ロール別権限・認可・セキュリティ・監査ログ
- `docs/optimization.md` — QUBO 定式化・制約・ソルバー・再検証・説明可能性

## アーキテクチャ

Feature-based モジュラーモノリス。Hono 公式 Best Practices に従い、機能ごとに Hono インスタンスを作り `app.route()` でマウントする。

```
src/
  app.ts        # 全モジュールを .route() でメソッドチェーン合成。ランタイム非依存に保つ
  lambda.ts     # hono/aws-lambda の handle(app)。本番（esbuild）のエントリ
  local.ts      # @hono/node-server の serve(app)。ローカル開発のエントリ
  env.ts        # 環境変数の Zod 検証
  db/
    client.ts   # Drizzle クライアント。モジュールスコープで生成（Lambda コンテナ再利用）。
                # Supabase の transaction pooler を使う場合は prepare: false 必須
    schema/     # テーブル定義をドメイン別に分割（participants.ts, assignments.ts, ...）
                # relations は relations.ts の1ファイルに集約する（分割すると壊れる Drizzle の制約）
    migrations/ # drizzle-kit generate の出力
  middleware/   # auth.ts（JWT 検証）, require-role.ts, logger.ts
  lib/          # create-app.ts, configure-openapi.ts, errors.ts（AppError 階層）,
                # schemas.ts（ページネーション等の共通 Zod）, clients/optimizer.ts
  modules/      # 12モジュール（auth / staff / participants / companies / internships /
                #   assignments / reports / evaluations / materials / badges /
                #   notifications / optimization）
optimizer/      # Python 最適化処理（独立した Lambda としてデプロイ）
```

各モジュールは `{機能名}.{レイヤー}.ts` で構成する:

```
modules/participants/
  participants.index.ts       # ルーターを合成して export（app.ts がマウントする）
  participants.routes.ts      # @hono/zod-openapi の createRoute() 定義（schema にのみ依存）
  participants.schema.ts      # Zod スキーマ（API 契約として手書き。DB スキーマとは独立に定義する）
  participants.handlers.ts    # 薄い handler: c.req.valid() → service 呼び出し → c.json()
  participants.service.ts     # ビジネスロジック。HTTP（Context）非依存、AppError を throw
  participants.repository.ts  # Drizzle クエリのみ（db/schema にだけ依存）
  participants.test.ts
```

- 依存方向（一方向のみ）: index → routes / handlers → service → repository → db/schema
- `lib/` と `db/` はモジュールに依存しない。モジュール間の直接 import は禁止（必要なら service 層経由）
- CRUD だけの小さいモジュール（badges 等）は service / repository を省略してよい（過剰レイヤー化を避ける）
- `src/`（TypeScript）と `optimizer/`（Python）はコードを共有しない。連携は Lambda 呼び出しの JSON のみ

### Hono の流儀（公式 Best Practices）

- RoR 風 Controller（ルート定義から分離した素のハンドラ関数）を作らない。型推論が壊れる。分離が必要な場合のみ hono/factory の createHandlers() を使う
- ルーターはメソッドチェーンで定義する（RPC 型導出が壊れるため別文で app.get() を並べない）
- app 本体（app.ts）にランタイム依存コードを混入させない（lambda.ts / local.ts と分離を保つ）

## API 設計ルール

- REST API。単純な CRUD に加え、業務操作を表すエンドポイントを用意する
  - 例: `POST /assignments/{id}/confirm` `POST /assignments/{id}/cancel` `POST /assignments/{id}/start` `POST /assignments/{id}/complete` `POST /optimization-runs` `POST /reports/{id}/review`
- エラー形式は統一する。エラーコード: `VALIDATION_ERROR` `UNAUTHENTICATED` `FORBIDDEN` `NOT_FOUND` `CONFLICT` `ASSIGNMENT_CAPACITY_EXCEEDED` `OPTIMIZATION_FAILED` `INTERNAL_ERROR`
- Web と iOS は同じエラーコードを使う
- 一覧系はページネーション必須。必要な項目のみ返す
- 最適化処理は非同期実行（PENDING → RUNNING → SUCCEEDED / FAILED / CANCELLED）
- OpenAPI ドキュメントは @hono/zod-openapi で実装と同一スキーマから自動生成する（手書きで併走させない）
- 型共有は OpenAPI を正とし、web / iOS のクライアント型は OpenAPI から生成する（リポジトリが分かれているため Hono RPC は使わない）

## 状態管理ルール

状態は必ず定数（enum / union 型）で管理する。任意の文字列での管理は禁止。

- 実習割当: `DRAFT` → `PROPOSED` → `CONFIRMED` → `IN_PROGRESS` → `COMPLETED` / `CANCELLED`
- 日報: `DRAFT` → `SUBMITTED` → `REVIEWED` / `NEEDS_ACTION`
- 最適化実行: `PENDING` → `RUNNING` → `SUCCEEDED` / `FAILED` / `CANCELLED`

状態遷移はこの API 側で管理し、クライアントから任意の状態へ直接変更させない。
確定済み（CONFIRMED 以降）の割当を直接上書きしない。

## 認証・認可

- Supabase Auth の JWT を毎リクエスト検証する
- 確認事項: JWT が有効 / アカウントが停止されていない / ロールが操作に対応している / 対象リソースへのアクセス権がある
- ロール: 管理者（admin）/ 支援員（staff）/ 閲覧者（viewer）/ 利用者（iOS）
- 閲覧者は閲覧のみ。編集・削除・割当変更・データ出力は不可
- 支援員は担当利用者のみ編集可。CSV 等のデータ出力は管理者のみ
- RBAC は API 側で適用する。Supabase RLS は補助的な防衛線とする

### パス設計（クライアント別フォルダ分割はしない）

- 職員（Web）向け: ドメインルート（`/participants` `/reports/{id}/review`）
- 利用者本人（iOS）向け: **`/me` プレフィックス**（`/me/today` `/me/reports`）。JWT の本人のデータのみを返し、URL に他人の ID が入る余地を作らない
- 両者は同じドメインモジュール内に実装する（ルートが増えたら `{機能名}.me.routes.ts` に分割。Service / Repository は共有）

### 権限の置き場所（3層に固定。ハンドラ内に if を散らさない）

1. **ロール権限** → ルート定義のミドルウェア宣言（`requireRole("admin")` / `requireStaff()` / `requireParticipant()`）
2. **データ依存の権限**（担当利用者のみ編集可など） → `{機能名}.policy.ts` のポリシー関数に集約し、Service から呼ぶ
3. **本人スコープ**（/me 系） → Repository のクエリ段階で本人 ID に絞り、不正アクセスを構造的に排除する

監査ログは対象操作（docs/permissions.md）で `lib/audit.ts` の `audit()` を必ず呼ぶ。

## DB 変更ルール

- スキーマ変更は必ず Drizzle のマイグレーションで管理する。手動での DDL 実行は禁止
- 日報の原文は必ず保持する。支援員が修正する場合は原文を上書きせず、修正履歴（修正者・修正日時・修正理由）を別途保存する
- 翻訳は原文・原文言語・翻訳文・翻訳先言語・翻訳日時・翻訳サービスを保存する
- 監査ログの対象操作と保存項目は `docs/permissions.md` に従う

## 個人情報の扱い

- ログへ出力禁止: 氏名、日報本文、障害情報、配慮事項、メールアドレス、アクセストークン、パスワード、住所
- Python Lambda（最適化）へは匿名 ID と数値化された特徴のみを渡す。氏名・メールアドレス・日報本文は渡さない
- 通知本文に体調・障害情報・配慮事項などの機微情報を含めない
- Storage は原則非公開。ファイル取得時に認可確認を行う

## 最適化連携

1. Hono 側が DB から必要情報を取得し、最適化用データ（匿名 ID + 数値特徴）へ変換する
2. optimizer（Python Lambda）を呼び出し、候補結果を受け取る
3. **ソルバーの結果は未検証のまま保存しない。** 必ず再検証する: 二重割当なし / 定員超過なし / 禁止組み合わせなし / 日程重複なし / 必須配慮を満たす / 確定済み割当と競合しない
4. 制約違反のある候補は確定不可とする
5. 実行履歴を保存する（保存項目は `docs/database.md`）
6. Hono–optimizer 間で共通の Trace ID / Optimization Run ID を使用する
7. 最適化サービス停止時も通常機能（手動割当など）は動作し続けること

## optimizer（Python）のルール

- 役割は次に限定する: 問題定義の受け取り / QUBO 生成 / ソルバー実行 / 解のデコード / 制約違反検証 / スコア計算 / 候補結果返却。DB へは直接アクセスしない
- ソルバー（Exact Solver / OR-Tools / SA / OpenJij / D-Wave 等）は共通インターフェース経由で切り替え可能にし、呼び出し側を具体的なソルバーへ依存させない
- 通常運用はシミュレータ・古典手法。実機（量子アニーリング）は管理者のみ・回数や料金の制限つき
- QUBO 定式化はバージョン管理する。テストなしで定式化を変更しない
- ハード制約（二重割当禁止、定員、参加不可日、対応不可配慮、期間重複、確定済み競合）は変数生成段階で可能な限り除外する

## テスト方針

- Hono: Unit Test / Service Test / Repository Test / API Integration Test / Authorization Test
- 認可テストは必須: ロールごとに許可・拒否の両方を検証する
- 状態遷移のテストを書く（不正な遷移が拒否されること）
- optimizer: QUBO 生成テスト / 制約違反テスト / 小規模問題で ExactSolver（全探索）との比較 / 再現性テスト（seed 固定）/ ソルバー差し替えテスト / 解のデコードテスト / スコア再計算テスト / 実機接続はモックする

## 完了条件

- Lint / Format / Type Check / テストがすべて通ること
- 新規エンドポイントには Zod スキーマによる入力検証と認可チェックがあること
- マイグレーションが含まれる場合、マイグレーションが適用可能であること

## 禁止事項

- フロントエンド（Web / iOS）から DB を直接更新させる設計にしない
- 権限判定をフロントエンドだけに委ねない
- 日報本文や個人情報をログへ出力しない
- API 型を複数箇所で重複定義しない（スキーマから型を導出する）
- 状態を任意の文字列で管理しない
- 確定済み割当を直接上書きしない
- ソルバー結果を未検証のまま保存しない
- 特定の量子サービスへ業務ロジックを直接依存させない
