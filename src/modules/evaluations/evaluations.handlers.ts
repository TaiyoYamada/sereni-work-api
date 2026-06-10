import type { RouteHandler } from "@hono/zod-openapi";

import type { AppEnv } from "../../lib/types";
import { staffActor } from "../../middleware/require-role";
import type * as routes from "./evaluations.routes";
import { toEvaluationResponse } from "./evaluations.schema";
import { listEvaluations, upsertMyEvaluation } from "./evaluations.service";

export const list: RouteHandler<typeof routes.list, AppEnv> = async (c) => {
  const { assignmentId } = c.req.valid("query");
  const rows = await listEvaluations(assignmentId);
  return c.json(rows.map(toEvaluationResponse), 200);
};

export const upsert: RouteHandler<typeof routes.upsert, AppEnv> = async (c) => {
  const input = c.req.valid("json");
  const actor = staffActor(c.var.actor);
  const evaluation = await upsertMyEvaluation(actor, input);
  return c.json(toEvaluationResponse({ ...evaluation, staffName: actor.name }), 200);
};
