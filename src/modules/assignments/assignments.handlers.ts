import type { RouteHandler } from "@hono/zod-openapi";

import { audit } from "../../lib/audit";
import { todayInFacilityTz } from "../../lib/dates";
import { paginationMeta } from "../../lib/schemas";
import type { AppEnv } from "../../lib/types";
import { participantActor, staffActor } from "../../middleware/require-role";
import type * as meRoutes from "./assignments.me.routes";
import type * as routes from "./assignments.routes";
import { toAssignmentResponse } from "./assignments.schema";
import {
  cancelAssignment,
  completeAssignment,
  confirmAssignment,
  createAssignment,
  getAssignment,
  getMyToday,
  listAssignments,
  listMyAssignments,
  startAssignment,
  updateAssignment,
} from "./assignments.service";

export const list: RouteHandler<typeof routes.list, AppEnv> = async (c) => {
  const query = c.req.valid("query");
  const { rows, total } = await listAssignments(query);
  return c.json({ data: rows.map(toAssignmentResponse), meta: paginationMeta(query, total) }, 200);
};

export const getOne: RouteHandler<typeof routes.getOne, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const assignment = await getAssignment(id);
  return c.json(toAssignmentResponse(assignment), 200);
};

export const create: RouteHandler<typeof routes.create, AppEnv> = async (c) => {
  const input = c.req.valid("json");
  const assignment = await createAssignment(input);
  await audit(c, {
    action: "assignment.create",
    targetType: "assignment",
    targetId: assignment.id,
    after: assignment,
  });
  return c.json(toAssignmentResponse(assignment), 201);
};

export const patch: RouteHandler<typeof routes.patch, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const input = c.req.valid("json");
  const { before, after } = await updateAssignment(id, input);
  await audit(c, {
    action: "assignment.update",
    targetType: "assignment",
    targetId: id,
    before,
    after,
  });
  return c.json(toAssignmentResponse(after), 200);
};

export const confirm: RouteHandler<typeof routes.confirm, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const { before, after } = await confirmAssignment(staffActor(c.var.actor), id);
  await audit(c, {
    action: "assignment.confirm",
    targetType: "assignment",
    targetId: id,
    before,
    after,
  });
  return c.json(toAssignmentResponse(after), 200);
};

export const start: RouteHandler<typeof routes.start, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const { before, after } = await startAssignment(id);
  await audit(c, {
    action: "assignment.start",
    targetType: "assignment",
    targetId: id,
    before,
    after,
  });
  return c.json(toAssignmentResponse(after), 200);
};

export const complete: RouteHandler<typeof routes.complete, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const { before, after } = await completeAssignment(id);
  await audit(c, {
    action: "assignment.complete",
    targetType: "assignment",
    targetId: id,
    before,
    after,
  });
  return c.json(toAssignmentResponse(after), 200);
};

export const cancel: RouteHandler<typeof routes.cancel, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const { reason } = c.req.valid("json");
  const { before, after } = await cancelAssignment(id, reason);
  await audit(c, {
    action: "assignment.cancel",
    targetType: "assignment",
    targetId: id,
    before,
    after,
  });
  return c.json(toAssignmentResponse(after), 200);
};

export const today: RouteHandler<typeof meRoutes.today, AppEnv> = async (c) => {
  const actor = participantActor(c.var.actor);
  const row = await getMyToday(actor.id, todayInFacilityTz());
  return c.json(
    {
      today: row
        ? { assignment: toAssignmentResponse(row.assignment), company: row.company }
        : null,
    },
    200,
  );
};

export const listMine: RouteHandler<typeof meRoutes.listMine, AppEnv> = async (c) => {
  const query = c.req.valid("query");
  const actor = participantActor(c.var.actor);
  const { rows, total } = await listMyAssignments(actor.id, query);
  return c.json({ data: rows.map(toAssignmentResponse), meta: paginationMeta(query, total) }, 200);
};
