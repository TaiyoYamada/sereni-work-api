import { z } from "@hono/zod-openapi";

import { paginationQuerySchema, sortOrderSchema } from "../../lib/schemas";
import type { Report } from "./reports.domain";

export const reportStatusSchema = z.enum(["DRAFT", "SUBMITTED", "REVIEWED", "NEEDS_ACTION"]);

const score = z.number().int().min(1).max(5);

export const reportResponseSchema = z
  .object({
    id: z.uuid(),
    assignmentId: z.uuid(),
    participantId: z.uuid(),
    participantName: z.string(),
    reportDate: z.iso.date(),
    status: reportStatusSchema,
    workDescription: z.string().nullable(),
    didWell: z.string().nullable(),
    difficult: z.string().nullable(),
    enjoyed: z.string().nullable(),
    troubled: z.string().nullable(),
    satisfaction: z.number().int().nullable(),
    fatigue: z.number().int().nullable(),
    anxiety: z.number().int().nullable(),
    difficulty: z.number().int().nullable(),
    comfort: z.number().int().nullable(),
    instructionClarity: z.number().int().nullable(),
    wantsToContinue: z.number().int().nullable(),
    accommodationSufficient: z.boolean().nullable(),
    wantsConsultation: z.boolean(),
    freeText: z.string().nullable(),
    language: z.string(),
    interviewNeeded: z.boolean(),
    submittedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("Report");

export type ReportResponse = z.infer<typeof reportResponseSchema>;

export const reportCommentResponseSchema = z
  .object({
    id: z.uuid(),
    reportId: z.uuid(),
    staffId: z.uuid(),
    staffName: z.string(),
    body: z.string(),
    createdAt: z.iso.datetime(),
  })
  .openapi("ReportComment");

export type ReportCommentResponse = z.infer<typeof reportCommentResponseSchema>;

export const reportDetailResponseSchema = reportResponseSchema
  .extend({ comments: z.array(reportCommentResponseSchema) })
  .openapi("ReportDetail");

export const listReportsQuerySchema = paginationQuerySchema.extend({
  status: reportStatusSchema.optional(),
  participantId: z.uuid().optional(),
  assignmentId: z.uuid().optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  interviewNeeded: z.stringbool().optional(),
  sort: z.enum(["reportDate", "createdAt"]).default("reportDate"),
  order: sortOrderSchema.default("desc"),
});

export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;

/** 支援員の確認操作 */
export const reviewReportSchema = z
  .object({
    result: z.enum(["REVIEWED", "NEEDS_ACTION"]),
    interviewNeeded: z.boolean().optional(),
  })
  .openapi("ReviewReport");

export type ReviewReportInput = z.infer<typeof reviewReportSchema>;

/** 支援員による本文修正（原文は上書きせず修正履歴へ保存） */
export const reviseReportSchema = z
  .object({
    reason: z.string().min(1).max(1000),
    changes: z
      .object({
        workDescription: z.string().max(5000).optional(),
        didWell: z.string().max(5000).optional(),
        difficult: z.string().max(5000).optional(),
        enjoyed: z.string().max(5000).optional(),
        troubled: z.string().max(5000).optional(),
        freeText: z.string().max(10000).optional(),
      })
      .refine((v) => Object.keys(v).length > 0, { message: "修正内容を指定してください" }),
  })
  .openapi("ReviseReport");

export type ReviseReportInput = z.infer<typeof reviseReportSchema>;

export const createCommentSchema = z
  .object({ body: z.string().min(1).max(5000) })
  .openapi("CreateReportComment");

/** 利用者本人の日報提出（iOS。clientGeneratedId で冪等） */
export const submitMyReportSchema = z
  .object({
    assignmentId: z.uuid(),
    reportDate: z.iso.date(),
    clientGeneratedId: z.uuid(),
    workDescription: z.string().max(5000).optional(),
    didWell: z.string().max(5000).optional(),
    difficult: z.string().max(5000).optional(),
    enjoyed: z.string().max(5000).optional(),
    troubled: z.string().max(5000).optional(),
    satisfaction: score.optional(),
    fatigue: score.optional(),
    anxiety: score.optional(),
    difficulty: score.optional(),
    comfort: score.optional(),
    instructionClarity: score.optional(),
    wantsToContinue: score.optional(),
    accommodationSufficient: z.boolean().optional(),
    wantsConsultation: z.boolean().default(false),
    freeText: z.string().max(10000).optional(),
    language: z.string().max(10).default("ja"),
  })
  .openapi("SubmitMyReport");

export type SubmitMyReportInput = z.infer<typeof submitMyReportSchema>;

/** 利用者本人の実習前チェック提出（同日2回目は上書き） */
export const submitMyPreCheckSchema = z
  .object({
    assignmentId: z.uuid(),
    checkDate: z.iso.date(),
    condition: score.optional(),
    sleep: score.optional(),
    fatigue: score.optional(),
    anxiety: score.optional(),
    motivation: score.optional(),
    canParticipate: z.boolean().optional(),
    wantsConsultation: z.boolean().default(false),
    accommodationNotes: z.string().max(2000).optional(),
  })
  .openapi("SubmitMyPreCheck");

export type SubmitMyPreCheckInput = z.infer<typeof submitMyPreCheckSchema>;

export const preCheckResponseSchema = z
  .object({
    id: z.uuid(),
    assignmentId: z.uuid(),
    participantId: z.uuid(),
    checkDate: z.iso.date(),
    condition: z.number().int().nullable(),
    sleep: z.number().int().nullable(),
    fatigue: z.number().int().nullable(),
    anxiety: z.number().int().nullable(),
    motivation: z.number().int().nullable(),
    canParticipate: z.boolean().nullable(),
    wantsConsultation: z.boolean(),
    accommodationNotes: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("PreCheck");

export type ReportWithName = Report & { participantName: string };

export function toReportResponse(row: ReportWithName): ReportResponse {
  return {
    ...row,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
