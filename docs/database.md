# データ設計方針

## テーブル一覧（src/db/schema/）

| テーブル | 内容 |
|---|---|
| `staff` | 職員（admin / staff / viewer）。auth_user_id で Supabase Auth と紐付け |
| `participants` | 利用者。希望職種・スキル・配慮は text[]（項目確定後に正規化を検討） |
| `companies` | 実習先企業。受け入れ人数・対応可能配慮 |
| `assignments` | 実習割当。状態 enum + 期間 CHECK 制約 + 提案理由 |
| `pre_checks` | 実習前チェック（体調・睡眠・疲労・不安・意欲、1日1件） |
| `reports` | 日報。原文保持・冪等キー（client_generated_id）・1割当1日1件 |
| `report_comments` | 支援員コメント |
| `report_revisions` | 日報修正履歴（修正者・理由・変更前スナップショット） |
| `report_translations` | 日報翻訳（原文は reports 側に保持） |
| `evaluations` | 支援員評価（割当×支援員でユニーク） |
| `optimization_runs` | 最適化実行履歴。ソルバー固有メトリクスは solver_metrics(jsonb) |
| `audit_logs` | 監査ログ（追記専用） |

教材（materials）・バッジ（badges）・通知（notifications）のテーブルは項目確定後に追加する。

## データの正本

| データ | 正本 |
|---|---|
| 認証情報 | Supabase Auth |
| 職員情報 / 利用者情報 / 実習先情報 / 日報 / 実習割当 / 最適化確定結果 | PostgreSQL |
| 教材ファイル | Supabase Storage |
| iOS の日報下書き | SwiftData（クライアント側） |
| 最適化中間データ | Python Lambda 実行中のみ（永続化しない） |

SwiftData および Web 側キャッシュは正本として扱わない。

## 実習割当の状態

```
DRAFT → PROPOSED → CONFIRMED → IN_PROGRESS → COMPLETED
                                          └→ CANCELLED
```

- DRAFT: 作成途中 / PROPOSED: 自動提案済み / CONFIRMED: 確定済み
- IN_PROGRESS: 実習中 / COMPLETED: 完了 / CANCELLED: 中止
- 状態遷移は Hono API 側で管理する。クライアントから任意の状態へ直接変更させない

## 日報の状態

```
DRAFT → SUBMITTED → REVIEWED / NEEDS_ACTION
```

- 利用者本人が提出した文章は原文として必ず保持する
- 支援員が修正する場合は原文を上書きせず、修正履歴・修正者・修正日時・修正理由を保存する

## 翻訳データ

日報の翻訳は以下を保存する: 原文 / 原文の言語 / 翻訳文 / 翻訳先言語 / 翻訳日時 / 翻訳サービス。
原文は必ず保持する。翻訳失敗時も原文を表示可能とする。

## 最適化実行履歴

最適化実行ごとに保存する: 実行 ID / 実行者 / 実行日時 / 対象期間 / 対象利用者 / 対象実習先 / 使用ソルバー / 問題定義バージョン / QUBO バージョン / 変数数 / 制約数 / 重み / ペナルティ係数 / 乱数 seed / Num Reads / Chain Strength / 実行時間 / エネルギー / 制約違反数 / 実行状態 / エラー内容 / 選択された候補 / 手動修正内容 / 最終確定者
