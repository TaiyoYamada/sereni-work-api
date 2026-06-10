import type { participants, staff } from "../db/schema";

export type Staff = typeof staff.$inferSelect;
export type Participant = typeof participants.$inferSelect;

/** 認証済みの操作主体。staff（職員）か participant（利用者本人）のどちらか */
export type Actor =
  | { type: "staff"; staff: Staff }
  | { type: "participant"; participant: Participant };

/** Hono の Context 型。認証ミドルウェア通過後は actor が入る */
export type AppEnv = {
  Variables: {
    actor: Actor;
    /** リクエスト単位のトレース ID（監査ログ・最適化連携で使用） */
    traceId: string;
  };
};
