import { eq } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import { verify, verifyWithJwks } from "hono/jwt";

import { db } from "../db/client";
import { participants, staff } from "../db/schema";
import { env } from "../env";
import { AppError } from "../lib/errors";
import type { Actor, AppEnv, Participant, Staff } from "../lib/types";

/** actor の解決方法。テストでは finder を差し替える */
export type ActorFinders = {
  findStaffByAuthUserId: (authUserId: string) => Promise<Staff | undefined>;
  findParticipantByAuthUserId: (authUserId: string) => Promise<Participant | undefined>;
};

const defaultFinders: ActorFinders = {
  findStaffByAuthUserId: async (authUserId) =>
    db.query.staff.findFirst({ where: eq(staff.authUserId, authUserId) }),
  findParticipantByAuthUserId: async (authUserId) =>
    db.query.participants.findFirst({ where: eq(participants.authUserId, authUserId) }),
};

/**
 * 認証ミドルウェア。
 * 1. Bearer トークン（Supabase Auth の JWT）を検証する
 * 2. auth_user_id から staff / participant を解決する
 * 3. アカウントが停止されていないことを確認する
 * 4. c.var.actor に操作主体を載せる
 */
export function authenticate(finders: ActorFinders = defaultFinders): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const header = c.req.header("Authorization");
    if (!header?.startsWith("Bearer ")) {
      throw new AppError("UNAUTHENTICATED", 401, "認証が必要です");
    }

    const token = header.slice("Bearer ".length);
    let payload: Awaited<ReturnType<typeof verify>>;
    try {
      payload = await verifyToken(token);
    } catch {
      throw new AppError("UNAUTHENTICATED", 401, "トークンが無効です");
    }

    const authUserId = payload.sub;
    if (typeof authUserId !== "string" || authUserId.length === 0) {
      throw new AppError("UNAUTHENTICATED", 401, "トークンが無効です");
    }

    const actor = await resolveActor(authUserId, finders);
    c.set("actor", actor);
    c.set("traceId", c.req.header("X-Trace-Id") ?? crypto.randomUUID());

    await next();
  };
}

/**
 * トークンの alg ヘッダで検証方法を切り替える。
 * - 非対称鍵（ES256 等）: Supabase の JWKS（公開鍵）で検証。現行の標準
 * - HS256: レガシーシークレット（テスト・旧構成との互換用）
 */
async function verifyToken(token: string) {
  const headerPart = token.split(".")[0] ?? "";
  const header = JSON.parse(
    Buffer.from(headerPart.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
  ) as { alg?: string };

  if (header.alg === "HS256") {
    return verify(token, env.SUPABASE_JWT_SECRET, "HS256");
  }
  return verifyWithJwks(token, {
    jwks_uri: `${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
    allowedAlgorithms: ["ES256", "RS256"],
  });
}

async function resolveActor(authUserId: string, finders: ActorFinders): Promise<Actor> {
  const staffMember = await finders.findStaffByAuthUserId(authUserId);
  if (staffMember) {
    if (!staffMember.isActive) {
      throw new AppError("FORBIDDEN", 403, "アカウントが停止されています");
    }
    return { type: "staff", staff: staffMember };
  }

  const participant = await finders.findParticipantByAuthUserId(authUserId);
  if (participant) {
    if (!participant.isActive) {
      throw new AppError("FORBIDDEN", 403, "アカウントが停止されています");
    }
    return { type: "participant", participant };
  }

  // Auth 上のユーザーは存在するが業務テーブルに紐付かない（招待未完了など）
  throw new AppError("FORBIDDEN", 403, "アカウントが登録されていません");
}
