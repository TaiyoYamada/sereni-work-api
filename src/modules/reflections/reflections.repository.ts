import { desc, eq } from "drizzle-orm";

import { db } from "../../db/client";
import { reflections, staff } from "../../db/schema";
import type { Reflection, ReflectionWithName } from "./reflections.schema";

type InsertValues = typeof reflections.$inferInsert;

const withNameSelect = {
  id: reflections.id,
  participantId: reflections.participantId,
  staffId: reflections.staffId,
  meetingDate: reflections.meetingDate,
  notes: reflections.notes,
  createdAt: reflections.createdAt,
  updatedAt: reflections.updatedAt,
  staffName: staff.name,
};

export const reflectionsRepository = {
  /** 利用者の振り返り記録（面談日の新しい順）。記録者名を含める */
  async listByParticipant(participantId: string): Promise<ReflectionWithName[]> {
    return db
      .select(withNameSelect)
      .from(reflections)
      .innerJoin(staff, eq(reflections.staffId, staff.id))
      .where(eq(reflections.participantId, participantId))
      .orderBy(desc(reflections.meetingDate), desc(reflections.createdAt));
  },

  async findById(id: string): Promise<Reflection | undefined> {
    const rows = await db.select().from(reflections).where(eq(reflections.id, id)).limit(1);
    return rows[0];
  },

  async findByIdWithName(id: string): Promise<ReflectionWithName | undefined> {
    const rows = await db
      .select(withNameSelect)
      .from(reflections)
      .innerJoin(staff, eq(reflections.staffId, staff.id))
      .where(eq(reflections.id, id))
      .limit(1);
    return rows[0];
  },

  async create(values: InsertValues): Promise<Reflection> {
    const rows = await db.insert(reflections).values(values).returning();
    return rows[0]!;
  },

  async update(id: string, values: Partial<InsertValues>): Promise<Reflection | undefined> {
    const rows = await db
      .update(reflections)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(reflections.id, id))
      .returning();
    return rows[0];
  },

  async remove(id: string): Promise<void> {
    await db.delete(reflections).where(eq(reflections.id, id));
  },
};

export type ReflectionsRepository = typeof reflectionsRepository;
