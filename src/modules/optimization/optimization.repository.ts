import { and, count, desc, eq, inArray } from "drizzle-orm";

import { db } from "../../db/client";
import { assignments, optimizationRuns } from "../../db/schema";
import type { OptimizationRun } from "./optimization.schema";

type InsertValues = typeof optimizationRuns.$inferInsert;

export const optimizationRepository = {
  async create(values: InsertValues): Promise<OptimizationRun> {
    const inserted = await db.insert(optimizationRuns).values(values).returning();
    return inserted[0]!;
  },

  async update(id: string, values: Partial<InsertValues>): Promise<OptimizationRun | undefined> {
    const updated = await db
      .update(optimizationRuns)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(optimizationRuns.id, id))
      .returning();
    return updated[0];
  },

  async findById(id: string): Promise<OptimizationRun | undefined> {
    return db.query.optimizationRuns.findFirst({ where: eq(optimizationRuns.id, id) });
  },

  async list(query: {
    page: number;
    perPage: number;
  }): Promise<{ rows: OptimizationRun[]; total: number }> {
    const [rows, totals] = await Promise.all([
      db
        .select()
        .from(optimizationRuns)
        .orderBy(desc(optimizationRuns.createdAt))
        .limit(query.perPage)
        .offset((query.page - 1) * query.perPage),
      db.select({ value: count() }).from(optimizationRuns),
    ]);
    return { rows, total: totals[0]?.value ?? 0 };
  },

  /** 公平性・ローテーション計算用の実習履歴（完了した割当のみ） */
  async getParticipantHistory(
    participantIds: string[],
  ): Promise<{ participantId: string; companyId: string }[]> {
    if (participantIds.length === 0) return [];
    return db
      .select({
        participantId: assignments.participantId,
        companyId: assignments.companyId,
      })
      .from(assignments)
      .where(
        and(
          inArray(assignments.participantId, participantIds),
          eq(assignments.status, "COMPLETED"),
        ),
      );
  },
};

export type OptimizationRepository = typeof optimizationRepository;
