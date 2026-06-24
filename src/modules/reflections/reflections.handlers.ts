import type { RouteHandler } from "@hono/zod-openapi";

import type { AppEnv } from "../../lib/types";
import { staffActor } from "../../middleware/require-role";
import type * as routes from "./reflections.routes";
import { toReflectionResponse } from "./reflections.schema";
import {
  createReflection,
  deleteReflection,
  listReflections,
  updateReflection,
} from "./reflections.service";

export const list: RouteHandler<typeof routes.list, AppEnv> = async (c) => {
  const { participantId } = c.req.valid("param");
  const rows = await listReflections(participantId);
  return c.json(rows.map(toReflectionResponse), 200);
};

export const create: RouteHandler<typeof routes.create, AppEnv> = async (c) => {
  const input = c.req.valid("json");
  const actor = staffActor(c.var.actor);
  const reflection = await createReflection(actor, input);
  return c.json(toReflectionResponse({ ...reflection, staffName: actor.name }), 201);
};

export const update: RouteHandler<typeof routes.update, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const input = c.req.valid("json");
  const actor = staffActor(c.var.actor);
  const reflection = await updateReflection(actor, id, input);
  return c.json(toReflectionResponse(reflection), 200);
};

export const remove: RouteHandler<typeof routes.remove, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const actor = staffActor(c.var.actor);
  await deleteReflection(actor, id);
  return c.body(null, 204);
};
