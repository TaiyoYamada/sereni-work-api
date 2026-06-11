import { z } from "@hono/zod-openapi";

import { paginationQuerySchema, sortOrderSchema } from "../../lib/schemas";
import type { companies } from "../../db/schema";

export type Company = typeof companies.$inferSelect;

export const companyResponseSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    industry: z.string().nullable(),
    internshipDescription: z.string().nullable(),
    requiredSkills: z.array(z.string()),
    supportedAccommodations: z.array(z.string()),
    capacity: z.number().int(),
    availableSchedule: z.string().nullable(),
    workHours: z.string().nullable(),
    contactName: z.string().nullable(),
    contactEmail: z.string().nullable(),
    contactPhone: z.string().nullable(),
    address: z.string().nullable(),
    belongings: z.string().nullable(),
    emergencyContact: z.string().nullable(),
    isActive: z.boolean(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("Company");

export type CompanyResponse = z.infer<typeof companyResponseSchema>;

export const createCompanySchema = z
  .object({
    name: z.string().min(1).max(200),
    industry: z.string().max(100).optional(),
    internshipDescription: z.string().max(5000).optional(),
    requiredSkills: z.array(z.string().min(1)).default([]),
    supportedAccommodations: z.array(z.string().min(1)).default([]),
    capacity: z.number().int().min(1).max(100).default(1),
    availableSchedule: z.string().max(2000).optional(),
    workHours: z.string().max(500).optional(),
    contactName: z.string().max(100).optional(),
    contactEmail: z.email().optional(),
    contactPhone: z.string().max(50).optional(),
    address: z.string().max(500).optional(),
    belongings: z.string().max(2000).optional(),
    emergencyContact: z.string().max(500).optional(),
  })
  .openapi("CreateCompany");

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

export const updateCompanySchema = createCompanySchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .openapi("UpdateCompany");

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

export const listCompaniesQuerySchema = paginationQuerySchema.extend({
  /** 企業名・業種の部分一致検索 */
  q: z.string().max(100).optional(),
  isActive: z.stringbool().optional(),
  sort: z.enum(["name", "capacity", "createdAt"]).default("createdAt"),
  order: sortOrderSchema.default("desc"),
});

export type ListCompaniesQuery = z.infer<typeof listCompaniesQuerySchema>;

export function toCompanyResponse(row: Company): CompanyResponse {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
