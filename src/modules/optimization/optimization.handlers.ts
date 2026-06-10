import type { RouteHandler } from "@hono/zod-openapi";

import { audit } from "../../lib/audit";
import { paginationMeta } from "../../lib/schemas";
import type { AppEnv } from "../../lib/types";
import { staffActor } from "../../middleware/require-role";
import type * as routes from "./optimization.routes";
import { toRunResponse } from "./optimization.schema";
import { adoptCandidate, getRun, listRuns, runOptimization } from "./optimization.service";

export const create: RouteHandler<typeof routes.create, AppEnv> = async (c) => {
  const input = c.req.valid("json");
  const run = await runOptimization(staffActor(c.var.actor), input);
  await audit(c, {
    action: "optimization.run",
    targetType: "optimization_run",
    targetId: run.id,
    after: { solver: run.solver, status: run.status },
  });
  return c.json(toRunResponse(run), 201);
};

export const list: RouteHandler<typeof routes.list, AppEnv> = async (c) => {
  const query = c.req.valid("query");
  const { rows, total } = await listRuns(query);
  return c.json({ data: rows.map(toRunResponse), meta: paginationMeta(query, total) }, 200);
};

export const getOne: RouteHandler<typeof routes.getOne, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const run = await getRun(id);
  return c.json(toRunResponse(run), 200);
};

export const adopt: RouteHandler<typeof routes.adopt, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const { candidateIndex } = c.req.valid("json");
  const run = await adoptCandidate(id, candidateIndex);
  await audit(c, {
    action: "optimization.adopt",
    targetType: "optimization_run",
    targetId: id,
    after: { candidateIndex },
  });
  return c.json(toRunResponse(run), 200);
};
