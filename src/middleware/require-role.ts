import type { MiddlewareHandler } from "hono";

import { AppError } from "../lib/errors";
import type { AppEnv, Participant, Staff } from "../lib/types";

export type StaffRole = Staff["role"];

/** 職員（指定ロールのいずれか）だけを通す。authenticate() の後段に置く */
export function requireRole(...roles: [StaffRole, ...StaffRole[]]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const actor = c.var.actor;
    if (actor.type !== "staff") {
      throw new AppError("FORBIDDEN", 403, "職員のみ利用できます");
    }
    if (!roles.includes(actor.staff.role)) {
      throw new AppError("FORBIDDEN", 403, "この操作を行う権限がありません");
    }
    await next();
  };
}

/** 職員（全ロール）だけを通す。閲覧系ルートの基本ガード */
export function requireStaff(): MiddlewareHandler<AppEnv> {
  return requireRole("admin", "staff", "viewer");
}

/** 利用者本人だけを通す（/me 系ルート用） */
export function requireParticipant(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (c.var.actor.type !== "participant") {
      throw new AppError("FORBIDDEN", 403, "利用者本人のみ利用できます");
    }
    await next();
  };
}

/** ハンドラ・Service 内で職員 actor を取り出す（型を絞る） */
export function staffActor(actor: AppEnv["Variables"]["actor"]): Staff {
  if (actor.type !== "staff") {
    throw new AppError("FORBIDDEN", 403, "職員のみ利用できます");
  }
  return actor.staff;
}

/** ハンドラ・Service 内で利用者 actor を取り出す（型を絞る） */
export function participantActor(actor: AppEnv["Variables"]["actor"]): Participant {
  if (actor.type !== "participant") {
    throw new AppError("FORBIDDEN", 403, "利用者本人のみ利用できます");
  }
  return actor.participant;
}
