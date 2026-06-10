import { and, count, desc, eq, gte, lte, type SQL } from "drizzle-orm";

import { db } from "../../db/client";
import {
  participants,
  preChecks,
  reportComments,
  reportRevisions,
  reports,
  staff,
} from "../../db/schema";
import type { Report } from "./reports.domain";
import type { ListReportsQuery, ReportWithName } from "./reports.schema";

type InsertValues = typeof reports.$inferInsert;
type PreCheck = typeof preChecks.$inferSelect;
type PreCheckInsert = typeof preChecks.$inferInsert;
export type ReportCommentWithName = typeof reportComments.$inferSelect & { staffName: string };

const withName = {
  id: reports.id,
  assignmentId: reports.assignmentId,
  participantId: reports.participantId,
  reportDate: reports.reportDate,
  status: reports.status,
  workDescription: reports.workDescription,
  didWell: reports.didWell,
  difficult: reports.difficult,
  enjoyed: reports.enjoyed,
  troubled: reports.troubled,
  satisfaction: reports.satisfaction,
  fatigue: reports.fatigue,
  anxiety: reports.anxiety,
  difficulty: reports.difficulty,
  comfort: reports.comfort,
  instructionClarity: reports.instructionClarity,
  wantsToContinue: reports.wantsToContinue,
  accommodationSufficient: reports.accommodationSufficient,
  wantsConsultation: reports.wantsConsultation,
  freeText: reports.freeText,
  language: reports.language,
  clientGeneratedId: reports.clientGeneratedId,
  submittedAt: reports.submittedAt,
  interviewNeeded: reports.interviewNeeded,
  createdAt: reports.createdAt,
  updatedAt: reports.updatedAt,
  participantName: participants.name,
};

function joined() {
  return db
    .select(withName)
    .from(reports)
    .innerJoin(participants, eq(reports.participantId, participants.id));
}

export const reportsRepository = {
  async list(query: ListReportsQuery): Promise<{ rows: ReportWithName[]; total: number }> {
    const conditions: SQL[] = [];
    if (query.status) conditions.push(eq(reports.status, query.status));
    if (query.participantId) conditions.push(eq(reports.participantId, query.participantId));
    if (query.assignmentId) conditions.push(eq(reports.assignmentId, query.assignmentId));
    if (query.from) conditions.push(gte(reports.reportDate, query.from));
    if (query.to) conditions.push(lte(reports.reportDate, query.to));
    if (query.interviewNeeded !== undefined) {
      conditions.push(eq(reports.interviewNeeded, query.interviewNeeded));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, totals] = await Promise.all([
      joined()
        .where(where)
        .orderBy(desc(reports.reportDate), desc(reports.createdAt))
        .limit(query.perPage)
        .offset((query.page - 1) * query.perPage),
      db.select({ value: count() }).from(reports).where(where),
    ]);
    return { rows, total: totals[0]?.value ?? 0 };
  },

  async findById(id: string): Promise<ReportWithName | undefined> {
    const rows = await joined().where(eq(reports.id, id)).limit(1);
    return rows[0];
  },

  async findByClientGeneratedId(clientGeneratedId: string): Promise<Report | undefined> {
    return db.query.reports.findFirst({
      where: eq(reports.clientGeneratedId, clientGeneratedId),
    });
  },

  async findByAssignmentAndDate(assignmentId: string, reportDate: string) {
    return db.query.reports.findFirst({
      where: and(eq(reports.assignmentId, assignmentId), eq(reports.reportDate, reportDate)),
    });
  },

  async create(values: InsertValues): Promise<Report> {
    const inserted = await db.insert(reports).values(values).returning();
    return inserted[0]!;
  },

  async update(id: string, values: Partial<InsertValues>): Promise<Report | undefined> {
    const updated = await db
      .update(reports)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(reports.id, id))
      .returning();
    return updated[0];
  },

  async listComments(reportId: string): Promise<ReportCommentWithName[]> {
    return db
      .select({
        id: reportComments.id,
        reportId: reportComments.reportId,
        staffId: reportComments.staffId,
        body: reportComments.body,
        createdAt: reportComments.createdAt,
        updatedAt: reportComments.updatedAt,
        staffName: staff.name,
      })
      .from(reportComments)
      .innerJoin(staff, eq(reportComments.staffId, staff.id))
      .where(eq(reportComments.reportId, reportId))
      .orderBy(reportComments.createdAt);
  },

  async createComment(values: typeof reportComments.$inferInsert) {
    const inserted = await db.insert(reportComments).values(values).returning();
    return inserted[0]!;
  },

  async createRevision(values: typeof reportRevisions.$inferInsert) {
    const inserted = await db.insert(reportRevisions).values(values).returning();
    return inserted[0]!;
  },

  /** 実習前チェックの upsert（同一割当・同一日は上書き） */
  async upsertPreCheck(values: PreCheckInsert): Promise<PreCheck> {
    const rows = await db
      .insert(preChecks)
      .values(values)
      .onConflictDoUpdate({
        target: [preChecks.assignmentId, preChecks.checkDate],
        set: { ...values, updatedAt: new Date() },
      })
      .returning();
    return rows[0]!;
  },
};

export type ReportsRepository = typeof reportsRepository;
