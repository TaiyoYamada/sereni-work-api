import type { RouteHandler } from "@hono/zod-openapi";

import { audit } from "../../lib/audit";
import { paginationMeta } from "../../lib/schemas";
import type { AppEnv } from "../../lib/types";
import { staffActor } from "../../middleware/require-role";
import type * as routes from "./staff.routes";
import { toStaffResponse } from "./staff.schema";
import { createStaff, getStaff, inviteStaff, listStaff, updateStaff } from "./staff.service";

export const list: RouteHandler<typeof routes.list, AppEnv> = async (c) => {
  const query = c.req.valid("query");
  const { rows, total } = await listStaff(query);
  return c.json({ data: rows.map(toStaffResponse), meta: paginationMeta(query, total) }, 200);
};

export const getMe: RouteHandler<typeof routes.getMe, AppEnv> = async (c) => {
  return c.json(toStaffResponse(staffActor(c.var.actor)), 200);
};

export const getOne: RouteHandler<typeof routes.getOne, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const member = await getStaff(id);
  return c.json(toStaffResponse(member), 200);
};

export const create: RouteHandler<typeof routes.create, AppEnv> = async (c) => {
  const input = c.req.valid("json");
  const member = await createStaff(input);
  await audit(c, {
    action: "staff.create",
    targetType: "staff",
    targetId: member.id,
    after: member,
  });
  return c.json(toStaffResponse(member), 201);
};

export const invite: RouteHandler<typeof routes.invite, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const member = await inviteStaff(id);
  // アカウント発行は監査ログ必須対象（docs/permissions.md）
  await audit(c, { action: "staff.invite", targetType: "staff", targetId: id });
  return c.json(toStaffResponse(member), 200);
};

export const patch: RouteHandler<typeof routes.patch, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const input = c.req.valid("json");
  const { before, after } = await updateStaff(staffActor(c.var.actor), id, input);

  // 権限変更・アカウント停止は監査ログ必須対象（docs/permissions.md）
  const action =
    input.isActive === false
      ? "staff.deactivate"
      : input.role !== undefined && input.role !== before.role
        ? "staff.role_change"
        : "staff.update";
  await audit(c, { action, targetType: "staff", targetId: id, before, after });

  return c.json(toStaffResponse(after), 200);
};
