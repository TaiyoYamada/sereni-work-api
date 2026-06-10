# API 設計方針

REST API を採用する。単純な CRUD だけでなく、業務操作を表すエンドポイントを用意する。

## 業務エンドポイントの例

```
POST /assignments/{id}/confirm    # 割当確定
POST /assignments/{id}/cancel     # 割当取消
POST /assignments/{id}/start      # 実習開始
POST /assignments/{id}/complete   # 実習完了
POST /optimization-runs           # 最適化実行
POST /reports/{id}/review         # 日報確認
```

## エラー形式

API エラー形式は統一する。Web と iOS は同じエラーコードを利用する。

| コード | 意味 |
|---|---|
| `VALIDATION_ERROR` | 入力値検証エラー |
| `UNAUTHENTICATED` | 未認証 |
| `FORBIDDEN` | 権限なし |
| `NOT_FOUND` | 対象が存在しない |
| `CONFLICT` | 競合（楽観ロック・状態遷移違反など） |
| `ASSIGNMENT_CAPACITY_EXCEEDED` | 受け入れ定員超過 |
| `OPTIMIZATION_FAILED` | 最適化失敗 |
| `INTERNAL_ERROR` | サーバー内部エラー |

## 非機能

- 一覧系はページネーション必須。一覧画面では必要な情報のみ返す
- 最適化処理は非同期実行を基本とする
- 重複送信防止: iOS からの日報送信等はクライアント生成 ID + 冪等キーを受け付ける
