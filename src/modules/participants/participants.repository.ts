import { and, asc, count, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";

import { db } from "../../db/client";
import { participants } from "../../db/schema";
import type { Participant } from "../../lib/types";
import type { ListParticipantsQuery } from "./participants.schema";

type InsertValues = typeof participants.$inferInsert;

export const participantsRepository = {
  async list(query: ListParticipantsQuery): Promise<{ rows: Participant[]; total: number }> {
    const conditions: SQL[] = [];
    if (query.q) {
      const pattern = `%${query.q}%`;
      const search = or(ilike(participants.name, pattern), ilike(participants.kana, pattern));
      if (search) conditions.push(search);
    }
    if (query.assignedStaffId) {
      conditions.push(eq(participants.assignedStaffId, query.assignedStaffId));
    }
    if (query.isActive !== undefined) {
      conditions.push(eq(participants.isActive, query.isActive));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const sortColumns = { name: participants.name, createdAt: participants.createdAt };
    const direction = query.order === "asc" ? asc : desc;

    const [rows, totals] = await Promise.all([
      db
        .select()
        .from(participants)
        .where(where)
        .orderBy(direction(sortColumns[query.sort]))
        .limit(query.perPage)
        .offset((query.page - 1) * query.perPage),
      db.select({ value: count() }).from(participants).where(where),
    ]);
    return { rows, total: totals[0]?.value ?? 0 };
  },

  async findById(id: string): Promise<Participant | undefined> {
    return db.query.participants.findFirst({ where: eq(participants.id, id) });
  },

  async findByIds(ids: string[]): Promise<Participant[]> {
    if (ids.length === 0) return [];
    return db.select().from(participants).where(inArray(participants.id, ids));
  },

  async create(values: InsertValues): Promise<Participant> {
    const inserted = await db.insert(participants).values(values).returning();
    return inserted[0]!;
  },

  async update(id: string, values: Partial<InsertValues>): Promise<Participant | undefined> {
    const updated = await db
      .update(participants)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(participants.id, id))
      .returning();
    return updated[0];
  },
};

export type ParticipantsRepository = typeof participantsRepository;
