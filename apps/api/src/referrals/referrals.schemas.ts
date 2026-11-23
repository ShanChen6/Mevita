import { z } from 'zod';
import { ReferralPriority, ReferralStatus } from '../generated/prisma/enums.js';

const text = (min: number, max: number, label: string) =>
  z.string().trim().min(min, `Nhập ${label}`).max(max);

export const createReferralSchema = z.object({
  sourceRecordId: z.uuid(),
  toFacilityId: z.uuid('Chọn bệnh viện tuyến trên'),
  priority: z.enum(ReferralPriority),
  reason: text(5, 1000, 'lý do chuyển tuyến'),
  clinicalSummary: text(10, 5000, 'tóm tắt bệnh án'),
  initialTreatment: z
    .string()
    .trim()
    .max(5000)
    .nullish()
    .transform((v) => v || null),
  escortId: z
    .uuid()
    .nullish()
    .transform((v) => v ?? null),
  vehicleInfo: z
    .string()
    .trim()
    .max(100)
    .nullish()
    .transform((v) => v || null),
  /** Thời gian dự kiến xe tới nơi (phút) */
  etaMinutes: z.number().int().min(5, 'Tối thiểu 5 phút').max(600, 'Tối đa 600 phút'),
});
export type CreateReferralInput = z.infer<typeof createReferralSchema>;

export const destinationsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
});

export const listReferralsQuerySchema = z.object({
  direction: z.enum(['incoming', 'outgoing']),
  status: z.enum(ReferralStatus).optional(),
  /** Chỉ ca đang hoạt động (chờ tiếp nhận / đang tới) */
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});
export type ListReferralsQuery = z.infer<typeof listReferralsQuerySchema>;

export const cancelReferralSchema = z.object({
  reason: text(3, 500, 'lý do huỷ'),
});
