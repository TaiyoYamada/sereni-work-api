// relations は必ずこの1ファイルに集約する（分割すると Drizzle の型解決が壊れる）
import { relations } from "drizzle-orm";

import { assignments } from "./assignments";
import { companies } from "./companies";
import { evaluations } from "./evaluations";
import { optimizationRuns } from "./optimization";
import { participants } from "./participants";
import { preChecks, reportComments, reportRevisions, reports, reportTranslations } from "./reports";
import { staff } from "./staff";

export const staffRelations = relations(staff, ({ many }) => ({
  assignedParticipants: many(participants),
  reportComments: many(reportComments),
  evaluations: many(evaluations),
}));

export const participantsRelations = relations(participants, ({ one, many }) => ({
  assignedStaff: one(staff, {
    fields: [participants.assignedStaffId],
    references: [staff.id],
  }),
  assignments: many(assignments),
  reports: many(reports),
  preChecks: many(preChecks),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  assignments: many(assignments),
}));

export const assignmentsRelations = relations(assignments, ({ one, many }) => ({
  participant: one(participants, {
    fields: [assignments.participantId],
    references: [participants.id],
  }),
  company: one(companies, {
    fields: [assignments.companyId],
    references: [companies.id],
  }),
  confirmedBy: one(staff, {
    fields: [assignments.confirmedByStaffId],
    references: [staff.id],
  }),
  optimizationRun: one(optimizationRuns, {
    fields: [assignments.optimizationRunId],
    references: [optimizationRuns.id],
  }),
  reports: many(reports),
  preChecks: many(preChecks),
  evaluations: many(evaluations),
}));

export const preChecksRelations = relations(preChecks, ({ one }) => ({
  assignment: one(assignments, {
    fields: [preChecks.assignmentId],
    references: [assignments.id],
  }),
  participant: one(participants, {
    fields: [preChecks.participantId],
    references: [participants.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one, many }) => ({
  assignment: one(assignments, {
    fields: [reports.assignmentId],
    references: [assignments.id],
  }),
  participant: one(participants, {
    fields: [reports.participantId],
    references: [participants.id],
  }),
  comments: many(reportComments),
  revisions: many(reportRevisions),
  translations: many(reportTranslations),
}));

export const reportCommentsRelations = relations(reportComments, ({ one }) => ({
  report: one(reports, {
    fields: [reportComments.reportId],
    references: [reports.id],
  }),
  staff: one(staff, {
    fields: [reportComments.staffId],
    references: [staff.id],
  }),
}));

export const reportRevisionsRelations = relations(reportRevisions, ({ one }) => ({
  report: one(reports, {
    fields: [reportRevisions.reportId],
    references: [reports.id],
  }),
  revisedBy: one(staff, {
    fields: [reportRevisions.revisedByStaffId],
    references: [staff.id],
  }),
}));

export const reportTranslationsRelations = relations(reportTranslations, ({ one }) => ({
  report: one(reports, {
    fields: [reportTranslations.reportId],
    references: [reports.id],
  }),
}));

export const evaluationsRelations = relations(evaluations, ({ one }) => ({
  assignment: one(assignments, {
    fields: [evaluations.assignmentId],
    references: [assignments.id],
  }),
  staff: one(staff, {
    fields: [evaluations.staffId],
    references: [staff.id],
  }),
}));

export const optimizationRunsRelations = relations(optimizationRuns, ({ one, many }) => ({
  executedBy: one(staff, {
    fields: [optimizationRuns.executedByStaffId],
    references: [staff.id],
  }),
  finalizedBy: one(staff, {
    fields: [optimizationRuns.finalizedByStaffId],
    references: [staff.id],
  }),
  assignments: many(assignments),
}));
