import { and, count, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";

import { db } from "../../db/client";
import { companies } from "../../db/schema";
import type { Company, ListCompaniesQuery } from "./companies.schema";

type InsertValues = typeof companies.$inferInsert;

export const companiesRepository = {
  async list(query: ListCompaniesQuery): Promise<{ rows: Company[]; total: number }> {
    const conditions: SQL[] = [];
    if (query.q) {
      const pattern = `%${query.q}%`;
      const search = or(ilike(companies.name, pattern), ilike(companies.industry, pattern));
      if (search) conditions.push(search);
    }
    if (query.isActive !== undefined) {
      conditions.push(eq(companies.isActive, query.isActive));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, totals] = await Promise.all([
      db
        .select()
        .from(companies)
        .where(where)
        .orderBy(desc(companies.createdAt))
        .limit(query.perPage)
        .offset((query.page - 1) * query.perPage),
      db.select({ value: count() }).from(companies).where(where),
    ]);
    return { rows, total: totals[0]?.value ?? 0 };
  },

  async findById(id: string): Promise<Company | undefined> {
    return db.query.companies.findFirst({ where: eq(companies.id, id) });
  },

  async findByIds(ids: string[]): Promise<Company[]> {
    if (ids.length === 0) return [];
    return db.select().from(companies).where(inArray(companies.id, ids));
  },

  async create(values: InsertValues): Promise<Company> {
    const inserted = await db.insert(companies).values(values).returning();
    return inserted[0]!;
  },

  async update(id: string, values: Partial<InsertValues>): Promise<Company | undefined> {
    const updated = await db
      .update(companies)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();
    return updated[0];
  },
};

export type CompaniesRepository = typeof companiesRepository;
