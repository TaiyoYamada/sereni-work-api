import { z } from "@hono/zod-openapi";

import { assignmentStatus, supportStages } from "../../db/schema/enums";

export const dashboardCountsSchema = z.object({
  inProgressAssignments: z.number().int(),
  confirmedAssignments: z.number().int(),
  submittedReports: z.number().int(),
  needsActionReports: z.number().int(),
  /** 面談希望（未確認・要対応の日報のみ） */
  interviewNeededReports: z.number().int(),
});

export const missingPreCheckSchema = z.object({
  assignmentId: z.uuid(),
  participantId: z.uuid(),
  participantName: z.string(),
  companyName: z.string(),
});

export const reportTrendPointSchema = z.object({
  date: z.iso.date(),
  /** その日に実習中だった割当数（= 日報の提出想定数） */
  expected: z.number().int(),
  /** その日付の提出済み日報数（下書きを除く） */
  submitted: z.number().int(),
});

export const conditionTrendPointSchema = z.object({
  date: z.iso.date(),
  condition: z.number().nullable(),
  fatigue: z.number().nullable(),
  anxiety: z.number().nullable(),
});

export const assignmentStatusCountSchema = z.object({
  status: z.enum(assignmentStatus.enumValues),
  count: z.number().int(),
});

/** 期限が近い利用者（受給者証の更新 / 利用上限2年） */
export const expiringParticipantSchema = z.object({
  participantId: z.uuid(),
  name: z.string(),
  reason: z.enum(["CERT", "USAGE_LIMIT"]),
  dueDate: z.iso.date(),
});

/** 支援ステージ別の在籍人数 */
export const stageCountSchema = z.object({
  stage: z.enum(supportStages),
  count: z.number().int(),
});

export const dashboardResponseSchema = z
  .object({
    counts: dashboardCountsSchema,
    today: z.object({
      date: z.iso.date(),
      expectedReports: z.number().int(),
      submittedReports: z.number().int(),
      missingPreChecks: z.array(missingPreCheckSchema),
    }),
    reportTrend: z.array(reportTrendPointSchema),
    conditionTrend: z.array(conditionTrendPointSchema),
    assignmentStatusCounts: z.array(assignmentStatusCountSchema),
    expiringParticipants: z.array(expiringParticipantSchema),
    stageDistribution: z.array(stageCountSchema),
  })
  .openapi("Dashboard");

export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
export type DashboardCounts = z.infer<typeof dashboardCountsSchema>;
export type MissingPreCheck = z.infer<typeof missingPreCheckSchema>;
export type ReportTrendPoint = z.infer<typeof reportTrendPointSchema>;
export type ConditionTrendPoint = z.infer<typeof conditionTrendPointSchema>;
export type AssignmentStatusCount = z.infer<typeof assignmentStatusCountSchema>;
export type ExpiringParticipant = z.infer<typeof expiringParticipantSchema>;
export type StageCount = z.infer<typeof stageCountSchema>;
