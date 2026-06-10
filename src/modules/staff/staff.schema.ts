import { z } from "@hono/zod-openapi";

import { paginationQuerySchema } from "../../lib/schemas";
import type { Staff } from "../../lib/types";

export const staffRoleSchema = z.enum(["admin", "staff", "viewer"]);

export const staffResponseSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    email: z.string(),
    role: staffRoleSchema,
    isActive: z.boolean(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi("Staff");

export type StaffResponse = z.infer<typeof staffResponseSchema>;

export const createStaffSchema = z
  .object({
    name: z.string().min(1).max(100),
    email: z.email(),
    role: staffRoleSchema.default("staff"),
  })
  .openapi("CreateStaff");

export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    role: staffRoleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .openapi("UpdateStaff");

export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;

export const listStaffQuerySchema = paginationQuerySchema.extend({
  q: z.string().max(100).optional(),
  role: staffRoleSchema.optional(),
  isActive: z.stringbool().optional(),
});

export type ListStaffQuery = z.infer<typeof listStaffQuerySchema>;

export function toStaffResponse(row: Staff): StaffResponse {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
