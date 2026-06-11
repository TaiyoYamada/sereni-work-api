import type { RouteHandler } from "@hono/zod-openapi";

import { todayInFacilityTz } from "../../lib/dates";
import type { AppEnv } from "../../lib/types";
import type * as routes from "./dashboard.routes";
import { getDashboard } from "./dashboard.service";

export const get: RouteHandler<typeof routes.getDashboard, AppEnv> = async (c) => {
  const dashboard = await getDashboard(todayInFacilityTz());
  return c.json(dashboard, 200);
};
