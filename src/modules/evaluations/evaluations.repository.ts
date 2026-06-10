import { eq } from "drizzle-orm";

import { db } from "../../db/client";
import { evaluations, staff } from "../../db/schema";
import type { EvaluationWithName } from "./evaluations.schema";

type InsertValues = typeof evaluations.$inferInsert;

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
