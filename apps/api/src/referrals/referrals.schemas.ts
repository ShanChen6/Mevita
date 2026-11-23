import { z } from 'zod';
import { ConsciousnessLevel, ReferralPriority, ReferralStatus } from '../generated/prisma/enums.js';

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

const int = (min: number, max: number, label: string) =>
  z
    .number()
    .int(`${label} phải là số nguyên`)
    .min(min, `${label} tối thiểu ${min}`)
    .max(max, `${label} tối đa ${max}`)
    .nullish()
    .transform((v) => v ?? null);

/** Một lần đo sinh tồn trên xe. `clientId` do thiết bị sinh — gửi lại nhiều lần vẫn chỉ ghi một bản. */
export const vitalEntrySchema = z
  .object({
    clientId: z.uuid(),
    recordedAt: z.iso.datetime({ offset: true }),
    pulse: int(20, 250, 'Mạch'),
    systolicBp: int(40, 300, 'HA tâm thu'),
    diastolicBp: int(20, 200, 'HA tâm trương'),
    spo2: int(50, 100, 'SpO2'),
    respiratoryRate: int(4, 80, 'Nhịp thở'),
    temperature: z
      .number()
      .min(30, 'Nhiệt độ tối thiểu 30')
      .max(45, 'Nhiệt độ tối đa 45')
      .nullish()
      .transform((v) => v ?? null),
    consciousness: z
      .enum(ConsciousnessLevel)
      .nullish()
      .transform((v) => v ?? null),
    gcs: int(3, 15, 'Glasgow'),
    note: z
      .string()
      .trim()
      .max(500)
      .nullish()
      .transform((v) => v || null),
  })
  .refine((v) => (v.systolicBp === null) === (v.diastolicBp === null), {
    message: 'Nhập đủ huyết áp tâm thu/tâm trương',
    path: ['systolicBp'],
  })
  .refine((v) => v.systolicBp === null || v.diastolicBp === null || v.systolicBp > v.diastolicBp, {
    message: 'HA tâm thu phải lớn hơn tâm trương',
    path: ['systolicBp'],
  })
  .refine(
    (v) =>
      [
        v.pulse,
        v.systolicBp,
        v.spo2,
        v.respiratoryRate,
        v.temperature,
        v.consciousness,
        v.gcs,
      ].some((x) => x !== null) || !!v.note,
    { message: 'Nhập ít nhất một chỉ số' },
  );
export type VitalEntryInput = z.infer<typeof vitalEntrySchema>;

export const vitalBatchSchema = z.object({
  entries: z.array(vitalEntrySchema).min(1).max(100),
});

/** Gói tin socket `vital_update` từ thiết bị trên xe */
export const vitalSocketSchema = vitalBatchSchema.extend({ referralId: z.uuid() });
