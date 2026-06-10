import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";

import { db } from "../../db/client";
import { staff } from "../../db/schema";
import type { Staff } from "../../lib/types";
import type { ListStaffQuery } from "./staff.schema";

type InsertValues = typeof staff.$inferInsert;

export const staffRepository = {
  async list(query: ListStaffQuery): Promise<{ rows: Staff[]; total: number }> {
    const conditions: SQL[] = [];
    if (query.q) {
      const pattern = `%${query.q}%`;
      const search = or(ilike(staff.name, pattern), ilike(staff.email, pattern));
      if (search) conditions.push(search);
    }
    if (query.role) conditions.push(eq(staff.role, query.role));
    if (query.isActive !== undefined) conditions.push(eq(staff.isActive, query.isActive));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, totals] = await Promise.all([
      db
        .select()
        .from(staff)
        .where(where)
        .orderBy(desc(staff.createdAt))
        .limit(query.perPage)
        .offset((query.page - 1) * query.perPage),
      db.select({ value: count() }).from(staff).where(where),
    ]);
    return { rows, total: totals[0]?.value ?? 0 };
  },

  async findById(id: string): Promise<Staff | undefined> {
    return db.query.staff.findFirst({ where: eq(staff.id, id) });
  },

  async findByEmail(email: string): Promise<Staff | undefined> {
    return db.query.staff.findFirst({ where: eq(staff.email, email) });
  },

  async create(values: InsertValues): Promise<Staff> {
    const inserted = await db.insert(staff).values(values).returning();
    return inserted[0]!;
  },

  async update(id: string, values: Partial<InsertValues>): Promise<Staff | undefined> {
    const updated = await db
      .update(staff)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(staff.id, id))
      .returning();
    return updated[0];
  },
};

export type StaffRepository = typeof staffRepository;
