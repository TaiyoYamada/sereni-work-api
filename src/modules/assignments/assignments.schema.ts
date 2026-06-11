import { z } from "@hono/zod-openapi";

import { paginationQuerySchema, sortOrderSchema } from "../../lib/schemas";
import type { Assignment } from "./assignments.domain";

export const assignmentStatusSchema = z.enum([
  "DRAFT",
  "PROPOSED",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

/** 一覧・詳細で返す形。表示用に利用者名・企業名を結合して返す */
export const assignmentResponseSchema = z
  .object({
    id: z.uuid(),
    participantId: z.uuid(),
    participantName: z.string(),
    companyId: z.uuid(),
    companyName: z.string(),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    status: assignmentStatusSchema,
    meetingPlace: z.string().nullable(),
    goal: z.string().nullable(),
    optimizationRunId: z.uuid().nullable(),
    proposalReason: z.string().nullable(),
    confirmedByStaffId: z.uuid().nullable(),
    confirmedAt: z.iso.datetime().nullable(),
    cancelledReason: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("Assignment");

export type AssignmentResponse = z.infer<typeof assignmentResponseSchema>;

/** 結合済みの行（Repository が返す形） */
export type AssignmentWithNames = Assignment & {
  participantName: string;
  companyName: string;
};

export const createAssignmentSchema = z
  .object({
    participantId: z.uuid(),
    companyId: z.uuid(),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    meetingPlace: z.string().max(500).optional(),
    goal: z.string().max(2000).optional(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "終了日は開始日以降にしてください",
    path: ["endDate"],
  })
  .openapi("CreateAssignment");

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;

export const updateAssignmentSchema = z
  .object({
    participantId: z.uuid().optional(),
    companyId: z.uuid().optional(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    meetingPlace: z.string().max(500).nullable().optional(),
    goal: z.string().max(2000).nullable().optional(),
  })
  .openapi("UpdateAssignment");

export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;

export const cancelAssignmentSchema = z
  .object({
    reason: z.string().min(1).max(2000),
  })
  .openapi("CancelAssignment");

export const listAssignmentsQuerySchema = paginationQuerySchema.extend({
  participantId: z.uuid().optional(),
  companyId: z.uuid().optional(),
  status: assignmentStatusSchema.optional(),
  /** この日付を含む期間の割当のみ（カレンダー表示用） */
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  sort: z.enum(["startDate", "createdAt"]).default("startDate"),
  order: sortOrderSchema.default("desc"),
});

export type ListAssignmentsQuery = z.infer<typeof listAssignmentsQuerySchema>;

export function toAssignmentResponse(row: AssignmentWithNames): AssignmentResponse {
  return {
    ...row,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
