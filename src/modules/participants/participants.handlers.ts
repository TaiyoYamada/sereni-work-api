import type { RouteHandler } from "@hono/zod-openapi";

import { audit } from "../../lib/audit";
import { paginationMeta } from "../../lib/schemas";
import type { AppEnv } from "../../lib/types";
import { staffActor } from "../../middleware/require-role";
import type * as routes from "./participants.routes";
import { toParticipantResponse } from "./participants.schema";
import {
  createParticipant,
  getParticipant,
  issueParticipantAccount,
  listParticipants,
  resetParticipantAccountPassword,
  updateParticipant,
} from "./participants.service";

export const list: RouteHandler<typeof routes.list, AppEnv> = async (c) => {
  const query = c.req.valid("query");
  const { rows, total } = await listParticipants(query);
  return c.json({ data: rows.map(toParticipantResponse), meta: paginationMeta(query, total) }, 200);
};

export const getOne: RouteHandler<typeof routes.getOne, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const participant = await getParticipant(id);
  await audit(c, { action: "participant.view", targetType: "participant", targetId: id });
  return c.json(toParticipantResponse(participant), 200);
};

export const create: RouteHandler<typeof routes.create, AppEnv> = async (c) => {
  const input = c.req.valid("json");
  const participant = await createParticipant(input);
  await audit(c, {
    action: "participant.create",
    targetType: "participant",
    targetId: participant.id,
    after: participant,
  });
  return c.json(toParticipantResponse(participant), 201);
};

export const issueAccount: RouteHandler<typeof routes.issueAccount, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const account = await issueParticipantAccount(staffActor(c.var.actor), id);
  // アカウント発行は監査ログ必須対象。初期パスワードは記録しない（docs/permissions.md）
  await audit(c, { action: "participant.account_issue", targetType: "participant", targetId: id });
  return c.json(account, 201);
};

export const resetAccountPassword: RouteHandler<
  typeof routes.resetAccountPassword,
  AppEnv
> = async (c) => {
  const { id } = c.req.valid("param");
  const account = await resetParticipantAccountPassword(staffActor(c.var.actor), id);
  await audit(c, {
    action: "participant.account_password_reset",
    targetType: "participant",
    targetId: id,
  });
  return c.json(account, 200);
};

export const patch: RouteHandler<typeof routes.patch, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const input = c.req.valid("json");
  const { before, after } = await updateParticipant(staffActor(c.var.actor), id, input);
  await audit(c, {
    action: "participant.update",
    targetType: "participant",
    targetId: id,
    before,
    after,
  });
  return c.json(toParticipantResponse(after), 200);
};
