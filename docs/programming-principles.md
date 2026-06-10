# Programming Principles（TypeScript）

コード品質を支える普遍原則。すべて「TypeScript 文脈ではどう落とし込むか」とセットで運用する。
違反する場合は、理由をコメントかコミットメッセージに残す。

## SOLID 原則

- **SRP（単一責任）**: 型・関数・モジュールは「変更理由が 1 つ」になるまで分割する。handler に DB アクセス・業務ロジック・整形を同居させない（layer 分離を守る）
- **OCP（開放/閉鎖）**: 既存コードを変更せず拡張できる設計にする。interface + 実装追加で分岐を増やす（巨大 `switch` で型判定しない）
- **LSP（リスコフの置換）**: interface 実装は契約（事前・事後条件・不変条件）を必ず守る。throw する実装としない実装を混ぜない
- **ISP（インタフェース分離）**: 大きな interface より、用途別の小さな interface の組み合わせを選ぶ
- **DIP（依存性逆転）**: 上位レイヤーは抽象（interface / 関数型）に依存し、具象を注入する。Service は DB クライアントを直接 import せず、Repository 経由で触る

## 基本原則

- **DRY**: 同じロジックを 3 回書いたら抽象化（Rule of Three）。ただし早すぎる抽象化は YAGNI に反する
- **KISS**: 常にシンプルな解を第一選択。ジェネリクス・条件型・型レベルプログラミングは必要性が明確になってから導入
- **YAGNI**: 「今必要な機能」だけ実装する。将来のための柔軟性は後で足す
- **POLA（最小驚きの原則）**: 関数名・型名から想像される挙動と実装を一致させる。副作用のある getter を作らない
- **Boy Scout Rule**: 触ったファイルは、触る前より少しだけ綺麗にして去る
- **Fail Fast**: 異常値は検知したその場で `throw` / Zod の `parse`。先送りしない
- **SSOT（唯一の情報源）**: 同じ状態を 2 箇所に持たない。派生値は計算で導出する。型は Zod スキーマ / Drizzle スキーマから `z.infer` / `$inferSelect` で導出し、手書きで重複定義しない

## 設計原則

- **High Cohesion / Low Coupling**: 1 つのモジュールは 1 つの関心事を束ね、他への依存は最小化する
- **Separation of Concerns**: HTTP・業務ロジック・I/O を層で分離（routes / handlers / service / repository の責務分担を徹底）
- **Composition over Inheritance**: class 継承より関数合成・オブジェクト合成を選ぶ。class は `AppError` 系など必要な場面に限定
- **Tell, Don't Ask**: 内部状態を問い合わせて外部で判断せず、対象に処理を委ねる
- **Command Query Separation**: 状態を変える関数（command）と値を返す関数（query）を分ける。同じ関数で両方やらない
- **Law of Demeter**: `a.b.c.d` のような train wreck を避ける。知っていいのは直接の隣人まで
- **Encapsulation**: モジュールの内部実装は export しない。公開 API を最小化する

## 型システムで不正な状態を排除する（TypeScript の強み）

- **Make Illegal States Unrepresentable**: 取りうる状態を判別共用体（discriminated union）で代数的に表す。
  例: `type LoadState<T> = { status: "idle" } | { status: "loading" } | { status: "loaded"; data: T } | { status: "failed"; error: AppError }` は
  `isLoading: boolean` + `data?: T` + `error?: Error` より安全
- **`const` by default**: 再代入しない変数は必ず `const`。`let` が必要な理由を説明できる場合のみ使う。プロパティは `readonly` を優先
- **`null` / `undefined` で欠損を表現**: 番兵値（`-1` / 空文字 / `"NONE"`）は禁止
- **`any` 禁止**: 型が不明な境界は `unknown` で受けて Zod で `parse` する（parse, don't validate）
- **境界で検証、内側は信頼**: 外部入力（HTTP / 環境変数 / 外部 API）は境界で Zod により検証し、内側のコードは検証済みの型を信頼する
- **Branded Type（Newtype）パターン**: `type ParticipantId = string & { readonly __brand: "ParticipantId" }` で ID の混同を防ぐ（Primitive Obsession の回避）
- **`as` キャスト原則禁止**: 型アサーションではなく型ガード・Zod・`satisfies` で型を証明する
- **enum より union 型**: `type Role = "admin" | "staff" | "viewer"`（DB の enum 定義と一致させる）

## 関数・メソッド設計

- **短く保つ**: 目安 20 行以内、1 画面に収まる長さ
- **一つのことをうまくやる**: 関数内の文は同じ抽象度で語る（詳細と抽象を混ぜない）
- **引数は 3 つ以内**を目標。多くなる場合はオブジェクト引数にまとめる
- **Boolean フラグ引数を避ける**: `doThing(force: true)` より `forceDoThing()` / `doThing()` に分ける
- **副作用を分離**: 純粋関数を優先し、I/O は境界に寄せる（Functional Core / Imperative Shell）
- **戻り値の意味を型で表す**: `boolean` より判別共用体。エラーは `AppError` を throw して onError で一元処理

## 制御フロー

- **早期 return**: 前提条件を先に弾き、幸せパスを最後に書く
- **ネストは最大 3 段**: それ以上深くなったら関数分割のサイン
- **Magic number / string 禁止**: `const MAX_RETRY_COUNT = 3` のように名前を付ける
- **網羅的 `switch`**: `default` に頼らず全 case を列挙し、`never` チェック（exhaustive check）で将来の追加をコンパイルエラーで検知する

## 命名

- **Intention-revealing**: `d` / `tmp` / `data2` 禁止。何を表すかを名前で語る
- **磁石ワードを避ける**: `Manager` / `Handler`（HTTP handler 以外） / `Processor` / `util2` は責務曖昧化のサイン。より具体的な名前を探す
- **抽象度を揃える**: 同じスコープの変数は同じレベルの概念で命名する
- **Boolean は述語形**: `isEmpty` / `hasChanges` / `canSubmit`（`flag` / `status` は NG）

## テスタビリティ

- **依存は外から注入**（DI）: Service は Repository を引数・ファクトリ経由で受け取れる形にし、テストでモックに差し替える
- **時間・乱数・UUID は抽象化**: `Date.now()` / `crypto.randomUUID()` の直呼びをロジック内に散らさず、境界で生成して渡す
- **副作用のあるコードを最小のラッパーに閉じ込め**、純粋ロジックを大きく取る
- **テストから書くと設計が歪みにくい**（TDD 的アプローチ）

## アンチパターン（避ける）

- **God Object / God Module**: 何でも知っている巨大ファイル → SRP で分割
- **Shotgun Surgery**: 1 つの変更で多数ファイルを触る → 凝集度を上げる
- **Feature Envy**: 他のモジュールのデータばかり触る関数 → そのモジュールに移動する
- **Primitive Obsession**: ID・金額・日時を `string` / `number` で直扱い → Branded Type / 専用型を作る
- **Long Parameter List**: パラメータ 4 個超 → オブジェクト引数化
- **Train Wreck**: `a.b.c.d.e.f()` → Law of Demeter 違反、中間に委譲関数を作る
- **Dead Code**: コメントアウトで残さない。Git が覚えている
- **巨大 `switch` での型判定**: OCP 違反 → ポリモーフィズム（オブジェクトマップ等）で置換
- **Temporal Coupling**: 「必ず A を呼んでから B」は型で強制できないか考える（builder / 状態を型で分ける）

## リファクタリングの規律

- **Rule of Three**: 2 回までは許容、3 回目で抽象化
- **テスト緑 → リファクタ → テスト緑** のサイクルを守り、振る舞いを変えない
- **リファクタと機能追加を同じコミットに混ぜない**
- **Boy Scout Rule**: 小さな改善を継続し、大規模書き換えを避ける

## Coding Conventions（TypeScript）

- 非 null アサーション（`!`）は原則使用しない。型ガード・`??` ・Zod で絞り込む（テスト・シードコードは例外可）
- `// TODO:` / `// FIXME:` は理由か Issue 番号を併記する
- コメントは「なぜそうしたか」を書く。「何をしているか」はコードで表現する
- 公開する関数・型には JSDoc（`/** */`）でサマリを書く
