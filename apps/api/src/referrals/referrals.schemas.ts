import { z } from 'zod';
import {
  ConsciousnessLevel,
  ReferralPriority,
  ReferralStatus,
  TransportMode,
} from '../generated/prisma/enums.js';

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
  /** Thời gian dự kiến xe tới nơi (phút) — không cần khi yêu cầu xe đón (tính khi có xe nhận) */
  etaMinutes: z.number().int().min(5, 'Tối thiểu 5 phút').max(600, 'Tối đa 600 phút').nullish(),
  /** Phương thức vận chuyển (Task C); bỏ trống = như cũ (chỉ ghi phương tiện bằng chữ) */
  transportMode: z.enum(TransportMode).nullish(),
  /** Xe của cơ sở (khi transportMode = FACILITY_VEHICLE) */
  vehicleId: z.uuid().nullish(),
  /** Lý do khi chọn phương tiện thấp hơn khuyến nghị */
  transportNote: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((v) => v || null),
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

/** Tuyến trên xác nhận tiếp nhận & sẵn sàng ê-kíp (ghi chú chuẩn bị tuỳ chọn) */
export const acceptReferralSchema = z.object({
  preparationNote: z
    .string()
    .trim()
    .max(1000)
    .nullish()
    .transform((v) => v || null),
});

export const preparationSchema = z.object({
  preparationNote: text(3, 1000, 'ghi chú chuẩn bị'),
});

export const rejectReferralSchema = z.object({
  reason: text(5, 500, 'lý do không thể tiếp nhận'),
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

export const transportOptionsSchema = z.object({
  toFacilityId: z.uuid().optional(),
});

export const dispatchSchema = z.object({
  vehicleId: z.uuid(),
});

/** Một điểm vị trí từ điện thoại trên xe */
export const locationEntrySchema = z.object({
  clientId: z.uuid(),
  recordedAt: z.iso.datetime({ offset: true }),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z
    .number()
    .min(0)
    .max(10_000)
    .nullish()
    .transform((v) => v ?? null),
  speed: z
    .number()
    .min(0)
    .max(100)
    .nullish()
    .transform((v) => v ?? null),
  heading: z
    .number()
    .min(0)
    .max(360)
    .nullish()
    .transform((v) => v ?? null),
});
export type LocationEntryInput = z.infer<typeof locationEntrySchema>;

export const locationBatchSchema = z.object({
  entries: z.array(locationEntrySchema).min(1).max(200),
});
export const locationSocketSchema = locationBatchSchema.extend({ referralId: z.uuid() });

const vehicleFields = {
  plateNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[0-9]{2}[A-Z]{1,2}[-\s.0-9]{4,10}$/, 'Biển số dạng 24A-115.15'),
  type: z.enum(['ADVANCED_AMBULANCE', 'BASIC_AMBULANCE', 'TRANSPORT']),
  equipment: z
    .string()
    .trim()
    .max(255)
    .nullish()
    .transform((v) => v || null),
  driverName: z
    .string()
    .trim()
    .max(150)
    .nullish()
    .transform((v) => v || null),
  driverPhone: z
    .string()
    .trim()
    .regex(/^0\d{9,10}$/, 'Số điện thoại 10–11 chữ số, bắt đầu bằng 0')
    .nullish()
    .or(z.literal('').transform(() => null))
    .transform((v) => v || null),
};
export const createVehicleSchema = z.object(vehicleFields);
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export const updateVehicleSchema = z
  .object({
    ...vehicleFields,
    status: z.enum(['AVAILABLE', 'MAINTENANCE']),
    isActive: z.boolean(),
  })
  .partial();
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
