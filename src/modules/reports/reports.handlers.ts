import type { RouteHandler } from "@hono/zod-openapi";

import { audit } from "../../lib/audit";
import { paginationMeta } from "../../lib/schemas";
import type { AppEnv } from "../../lib/types";
import { participantActor, staffActor } from "../../middleware/require-role";
import type * as meRoutes from "./reports.me.routes";
import type * as routes from "./reports.routes";
import { toReportResponse } from "./reports.schema";
import {
  addComment,
  getReport,
  getReportComments,
  listMyReports,
  listReports,
  reviewReport,
  reviseReport,
  submitMyPreCheck,
  submitMyReport,
} from "./reports.service";

export const list: RouteHandler<typeof routes.list, AppEnv> = async (c) => {
  const query = c.req.valid("query");
  const { rows, total } = await listReports(query);
  return c.json({ data: rows.map(toReportResponse), meta: paginationMeta(query, total) }, 200);
};

export const getOne: RouteHandler<typeof routes.getOne, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const report = await getReport(id);
  const comments = await getReportComments(id);
  await audit(c, { action: "report.view", targetType: "report", targetId: id });
  return c.json(
    {
      ...toReportResponse(report),
      comments: comments.map((comment) => ({
        id: comment.id,
        reportId: comment.reportId,
        staffId: comment.staffId,
        staffName: comment.staffName,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
      })),
    },
    200,
  );
};

export const review: RouteHandler<typeof routes.review, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const input = c.req.valid("json");
  const { before, after } = await reviewReport(id, input);
  await audit(c, { action: "report.review", targetType: "report", targetId: id, before, after });
  return c.json(toReportResponse(after), 200);
};

export const revise: RouteHandler<typeof routes.revise, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const input = c.req.valid("json");
  const { before, after } = await reviseReport(staffActor(c.var.actor), id, input);
  await audit(c, { action: "report.revise", targetType: "report", targetId: id, before, after });
  return c.json(toReportResponse(after), 200);
};

export const createComment: RouteHandler<typeof routes.addComment, AppEnv> = async (c) => {
  const { id } = c.req.valid("param");
  const { body } = c.req.valid("json");
  const actor = staffActor(c.var.actor);
  const comment = await addComment(actor, id, body);
  await audit(c, { action: "report.comment", targetType: "report", targetId: id });
  return c.json(
    {
      id: comment.id,
      reportId: comment.reportId,
      staffId: comment.staffId,
      staffName: actor.name,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
    },
    201,
  );
};

export const listMine: RouteHandler<typeof meRoutes.listMine, AppEnv> = async (c) => {
  const query = c.req.valid("query");
  const actor = participantActor(c.var.actor);
  const { rows, total } = await listMyReports(actor, query);
  return c.json({ data: rows.map(toReportResponse), meta: paginationMeta(query, total) }, 200);
};

export const submitMine: RouteHandler<typeof meRoutes.submitMine, AppEnv> = async (c) => {
  const input = c.req.valid("json");
  const actor = participantActor(c.var.actor);
  const { report, created } = await submitMyReport(actor, input);
  const response = toReportResponse({ ...report, participantName: actor.name });
  return created ? c.json(response, 201) : c.json(response, 200);
};

export const submitPreCheck: RouteHandler<typeof meRoutes.submitPreCheck, AppEnv> = async (c) => {
  const input = c.req.valid("json");
  const actor = participantActor(c.var.actor);
  const preCheck = await submitMyPreCheck(actor, input);
  return c.json(
    {
      ...preCheck,
      createdAt: preCheck.createdAt.toISOString(),
      updatedAt: preCheck.updatedAt.toISOString(),
    },
    200,
  );
};

export const profile: RouteHandler<typeof meRoutes.profile, AppEnv> = async (c) => {
  const actor = participantActor(c.var.actor);
  return c.json(
    { id: actor.id, name: actor.name, preferredLanguage: actor.preferredLanguage },
    200,
  );
};
