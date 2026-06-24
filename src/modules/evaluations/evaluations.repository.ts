import { eq, sql } from "drizzle-orm";
import { z } from "@hono/zod-openapi";

import { db } from "../../db/client";
import { evaluations, staff } from "../../db/schema";
import type { EvaluationWithName, ParticipantGrowthPoint } from "./evaluations.schema";

type InsertValues = typeof evaluations.$inferInsert;

// db.execute（生 SQL）の行は境界として Zod で検証してから返す
const growthRowSchema = z.object({
  assignment_id: z.string(),
  company_name: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  attitude: z.number().nullable(),
  aptitude: z.number().nullable(),
  communication: z.number().nullable(),
  accommodation_fit: z.number().nullable(),
  continuity: z.number().nullable(),
});

export const evaluationsRepository = {
  async listByAssignment(assignmentId: string): Promise<EvaluationWithName[]> {
    return db
      .select({
        id: evaluations.id,
        assignmentId: evaluations.assignmentId,
        staffId: evaluations.staffId,
        attitude: evaluations.attitude,
        aptitude: evaluations.aptitude,
        communication: evaluations.communication,
        accommodationFit: evaluations.accommodationFit,
        continuity: evaluations.continuity,
        nextNote: evaluations.nextNote,
        createdAt: evaluations.createdAt,
        updatedAt: evaluations.updatedAt,
        staffName: staff.name,
      })
      .from(evaluations)
      .innerJoin(staff, eq(evaluations.staffId, staff.id))
      .where(eq(evaluations.assignmentId, assignmentId))
      .orderBy(evaluations.createdAt);
  },

  /**
   * 利用者の成長（実習ごとに評価を集約した時系列）。
   * 評価のある割当のみ（inner join）。各軸は支援員横断の平均、評価が無い軸は null。
   * 実習期間の開始日昇順。
   */
  async listParticipantGrowth(participantId: string): Promise<ParticipantGrowthPoint[]> {
    const rows = await db.execute(sql`
      select
        a.id as assignment_id,
        c.name as company_name,
        to_char(a.start_date, 'YYYY-MM-DD') as start_date,
        to_char(a.end_date, 'YYYY-MM-DD') as end_date,
        round(avg(e.attitude)::numeric, 1)::float as attitude,
        round(avg(e.aptitude)::numeric, 1)::float as aptitude,
        round(avg(e.communication)::numeric, 1)::float as communication,
        round(avg(e.accommodation_fit)::numeric, 1)::float as accommodation_fit,
        round(avg(e.continuity)::numeric, 1)::float as continuity
      from assignments a
      join companies c on c.id = a.company_id
      join evaluations e on e.assignment_id = a.id
      where a.participant_id = ${participantId}
      group by a.id, c.name, a.start_date, a.end_date
      order by a.start_date, a.id
    `);
    return z
      .array(growthRowSchema)
      .parse(rows)
      .map((row) => ({
        assignmentId: row.assignment_id,
        companyName: row.company_name,
        startDate: row.start_date,
        endDate: row.end_date,
        attitude: row.attitude,
        aptitude: row.aptitude,
        communication: row.communication,
        accommodationFit: row.accommodation_fit,
        continuity: row.continuity,
      }));
  },

  /** 割当×支援員でユニーク。再送信は上書き */
  async upsert(values: InsertValues) {
    const rows = await db
      .insert(evaluations)
      .values(values)
      .onConflictDoUpdate({
        target: [evaluations.assignmentId, evaluations.staffId],
        set: { ...values, updatedAt: new Date() },
      })
      .returning();
    return rows[0]!;
  },
};

export type EvaluationsRepository = typeof evaluationsRepository;
