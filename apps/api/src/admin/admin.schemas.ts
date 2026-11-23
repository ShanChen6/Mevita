import { z } from 'zod';
import { UserRole } from '../generated/prisma/enums.js';

export const listUsersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(UserRole).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export type ListUsersQuery = z.infer<typeof listUsersSchema>;

export const setActiveSchema = z.object({ isActive: z.boolean() });

export const listAuditSchema = z.object({
  action: z.string().trim().max(50).optional(),
  entityType: z.string().trim().max(50).optional(),
  /** Tên / email người thao tác */
  q: z.string().trim().max(100).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListAuditQuery = z.infer<typeof listAuditSchema>;
