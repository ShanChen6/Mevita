import { z } from 'zod';
import { CommuneType, ProvinceType } from '../generated/prisma/enums.js';

export const provinceCodeSchema = z.string().regex(/^\d{2}$/, 'Mã tỉnh gồm đúng 2 chữ số');

export const communeCodeSchema = z.string().regex(/^\d{5}$/, 'Mã xã gồm đúng 5 chữ số');

export const listProvincesQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  type: z.enum(ProvinceType).optional(),
});
export type ListProvincesQuery = z.infer<typeof listProvincesQuerySchema>;

export const listCommunesQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  type: z.enum(CommuneType).optional(),
  provinceCode: provinceCodeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(5000).default(50),
});
export type ListCommunesQuery = z.infer<typeof listCommunesQuerySchema>;
