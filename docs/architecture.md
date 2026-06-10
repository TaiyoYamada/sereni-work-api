# アーキテクチャ

## 全体方針

- Feature-based Modular Monolith + Layered Architecture
- REST API / Repository Pattern
- 最適化処理のみ Python Lambda として分離（このリポジトリの optimizer/）

## 通信構成

- Web（Next.js / Vercel）と iOS は、この Hono API（AWS Lambda）を通じて業務データへアクセスする
- Web / iOS から Supabase PostgreSQL を直接更新しない
- optimizer（Python Lambda）も原則として Supabase PostgreSQL へ直接アクセスしない
- コンテナは Amazon ECR に保存。CI/CD は GitHub Actions
- エラー監視: Sentry / ログ: AWS CloudWatch

## Hono モジュール構成

機能単位で分割: auth / staff / participants / companies / internships / assignments / reports / evaluations / materials / badges / notifications / optimization

各モジュールは `{機能名}.{レイヤー}.ts` 形式（index / routes / schema / handlers / service / repository / test）。
エントリポイントは lambda.ts（本番）と local.ts（ローカル開発）に分離し、app.ts はランタイム非依存に保つ。

依存方向（一方向のみ）:

```
index → routes / handlers → service → repository → db/schema
```

## optimizer（Python Lambda）の役割

以下に限定する:

1. 問題定義の受け取り
2. QUBO 生成
3. ソルバー実行
4. 解のデコード
5. 制約違反検証
6. スコア計算
7. 候補結果返却

利用者名・メールアドレス・日報本文などの個人情報は optimizer へ渡さない。
匿名 ID と数値化された特徴のみを渡す。

## 最適化処理の流れ

1. Hono がデータベースから必要情報を取得する
2. 最適化用データへ変換する
3. Python Lambda を呼び出す
4. Python Lambda が最適化を実行する
5. Python Lambda が候補結果を返す
6. Hono が結果を検証する
7. Hono が結果をデータベースへ保存する
