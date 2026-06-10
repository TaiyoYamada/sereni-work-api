import type { RouteHandler } from "@hono/zod-openapi";

import { paginationMeta } from "../../lib/schemas";
import type { AppEnv } from "../../lib/types";
import type * as routes from "./companies.routes";
import { toCompanyResponse } from "./companies.schema";
import { createCompany, getCompany, listCompanies, updateCompany } from "./companies.service";

export const list: RouteHandler<typeof routes.list, AppEnv> = async (c) => {
  const query = c.req.valid("query");
  const { rows, total } = await listCompanies(query);
  return c.json({ data: rows.map(toCompanyResponse), meta: paginationMeta(query, total) }, 200);
};

export const getOne: RouteHandler<typeof routes.getOne, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const company = await getCompany(id);
  return c.json(toCompanyResponse(company), 200);
};

export const create: RouteHandler<typeof routes.create, AppEnv> = async (c) => {
  const input = c.req.valid("json");
  const company = await createCompany(input);
  return c.json(toCompanyResponse(company), 201);
};

export const patch: RouteHandler<typeof routes.patch, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const input = c.req.valid("json");
  const { after } = await updateCompany(id, input);
  return c.json(toCompanyResponse(after), 200);
};
