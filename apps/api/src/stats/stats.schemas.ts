import { z } from 'zod';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày dạng YYYY-MM-DD');

export const statsQuerySchema = z
  .object({
    from: date,
    to: date,
    /** Mã tỉnh/thành (2 chữ số) — lọc theo vị trí cơ sở y tế */
    province: z
      .string()
      .regex(/^\d{2}$/)
      .optional(),
  })
  .refine((q) => q.from <= q.to, {
    message: 'Ngày bắt đầu phải trước ngày kết thúc',
    path: ['from'],
  })
  .refine((q) => (Date.parse(q.to) - Date.parse(q.from)) / 86_400_000 <= 731, {
    message: 'Khoảng thời gian tối đa 2 năm',
    path: ['to'],
  });
export type StatsQuery = z.infer<typeof statsQuerySchema>;
