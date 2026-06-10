import { and, count, desc, eq, gte, inArray, lte, ne, type SQL } from "drizzle-orm";

import { db } from "../../db/client";
import { assignments, companies, participants } from "../../db/schema";
import type { Assignment } from "./assignments.domain";
import type { AssignmentWithNames, ListAssignmentsQuery } from "./assignments.schema";

type InsertValues = typeof assignments.$inferInsert;

/** 定員・重複の計算対象になる「枠を消費する」状態 */
const OCCUPYING_STATUSES = ["CONFIRMED", "IN_PROGRESS"] as const;

const withNames = {
  id: assignments.id,
  participantId: assignments.participantId,
  companyId: assignments.companyId,
  startDate: assignments.startDate,
  endDate: assignments.endDate,
  status: assignments.status,
  meetingPlace: assignments.meetingPlace,
  goal: assignments.goal,
  optimizationRunId: assignments.optimizationRunId,
  proposalReason: assignments.proposalReason,
  confirmedByStaffId: assignments.confirmedByStaffId,
  confirmedAt: assignments.confirmedAt,
  cancelledReason: assignments.cancelledReason,
  createdAt: assignments.createdAt,
  updatedAt: assignments.updatedAt,
  participantName: participants.name,
  companyName: companies.name,
};

function joined() {
  return db
    .select(withNames)
    .from(assignments)
    .innerJoin(participants, eq(assignments.participantId, participants.id))
    .innerJoin(companies, eq(assignments.companyId, companies.id));
}

export const assignmentsRepository = {
  async list(query: ListAssignmentsQuery): Promise<{ rows: AssignmentWithNames[]; total: number }> {
    const conditions: SQL[] = [];
    if (query.participantId) conditions.push(eq(assignments.participantId, query.participantId));
    if (query.companyId) conditions.push(eq(assignments.companyId, query.companyId));
    if (query.status) conditions.push(eq(assignments.status, query.status));
    // from/to: 指定期間と1日でも重なる割当（start <= to かつ end >= from）
    if (query.to) conditions.push(lte(assignments.startDate, query.to));
    if (query.from) conditions.push(gte(assignments.endDate, query.from));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, totals] = await Promise.all([
      joined()
        .where(where)
        .orderBy(desc(assignments.startDate), desc(assignments.createdAt))
        .limit(query.perPage)
        .offset((query.page - 1) * query.perPage),
      db.select({ value: count() }).from(assignments).where(where),
    ]);
    return { rows, total: totals[0]?.value ?? 0 };
  },

  async findById(id: string): Promise<AssignmentWithNames | undefined> {
    const rows = await joined().where(eq(assignments.id, id)).limit(1);
    return rows[0];
  },

  async create(values: InsertValues): Promise<Assignment> {
    const inserted = await db.insert(assignments).values(values).returning();
    return inserted[0]!;
  },

  async update(id: string, values: Partial<InsertValues>): Promise<Assignment | undefined> {
    const updated = await db
      .update(assignments)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(assignments.id, id))
      .returning();
    return updated[0];
  },

  /** 指定期間と重なる、枠を消費する割当の件数（企業の定員チェック用） */
  async countOccupyingForCompany(
    companyId: string,
    startDate: string,
    endDate: string,
    excludeId?: string,
  ): Promise<number> {
    const conditions: SQL[] = [
      eq(assignments.companyId, companyId),
      inArray(assignments.status, [...OCCUPYING_STATUSES]),
      lte(assignments.startDate, endDate),
      gte(assignments.endDate, startDate),
    ];
    if (excludeId) conditions.push(ne(assignments.id, excludeId));
    const totals = await db
      .select({ value: count() })
      .from(assignments)
      .where(and(...conditions));
    return totals[0]?.value ?? 0;
  },

  /** 今日の実習（利用者本人スコープ。iOS ホーム画面用に企業情報も返す） */
  async findTodayForParticipant(participantId: string, date: string) {
    const rows = await db
      .select({
        assignment: withNames,
        company: {
          workHours: companies.workHours,
          address: companies.address,
          belongings: companies.belongings,
          emergencyContact: companies.emergencyContact,
          contactName: companies.contactName,
          contactPhone: companies.contactPhone,
        },
      })
      .from(assignments)
      .innerJoin(participants, eq(assignments.participantId, participants.id))
      .innerJoin(companies, eq(assignments.companyId, companies.id))
      .where(
        and(
          eq(assignments.participantId, participantId),
          inArray(assignments.status, [...OCCUPYING_STATUSES]),
          lte(assignments.startDate, date),
          gte(assignments.endDate, date),
        ),
      )
      .limit(1);
    return rows[0];
  },

  /** 指定期間と重なる、利用者の確定済み・実習中の割当（同一利用者の二重割当チェック用） */
  async findOccupyingForParticipant(
    participantId: string,
    startDate: string,
    endDate: string,
    excludeId?: string,
  ): Promise<Assignment[]> {
    const conditions: SQL[] = [
      eq(assignments.participantId, participantId),
      inArray(assignments.status, [...OCCUPYING_STATUSES]),
      lte(assignments.startDate, endDate),
      gte(assignments.endDate, startDate),
    ];
    if (excludeId) conditions.push(ne(assignments.id, excludeId));
    return db
      .select()
      .from(assignments)
      .where(and(...conditions));
  },
};

export type AssignmentsRepository = typeof assignmentsRepository;
