import { z } from 'zod';

export const listFacilitiesQuerySchema = z.object({
  provinceCode: z
    .string()
    .regex(/^\d{2}$/)
    .optional(),
  communeCode: z
    .string()
    .regex(/^\d{5}$/)
    .optional(),
  specialtyCode: z.string().max(30).optional(),
  q: z.string().trim().min(1).max(100).optional(),
});
export type ListFacilitiesQuery = z.infer<typeof listFacilitiesQuerySchema>;

export const slotsQuerySchema = z.object({
  date: z.iso.date('Ngày không hợp lệ (YYYY-MM-DD)'),
  specialtyId: z.uuid('Chuyên khoa không hợp lệ'),
  doctorId: z.uuid().optional(),
});
export type SlotsQuery = z.infer<typeof slotsQuerySchema>;
