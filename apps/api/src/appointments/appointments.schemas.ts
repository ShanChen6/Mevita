import { z } from 'zod';
import { AppointmentStatus } from '../generated/prisma/enums.js';

export const createAppointmentSchema = z.object({
  facilityId: z.uuid(),
  specialtyId: z.uuid(),
  doctorId: z.uuid().nullish(),
  startAt: z.iso.datetime({ offset: true, message: 'Thời gian không hợp lệ' }),
  reason: z.string().trim().min(3, 'Nhập lý do khám (tối thiểu 3 ký tự)').max(500),
  initialSymptoms: z
    .string()
    .trim()
    .max(2000)
    .nullish()
    .transform((v) => v || null),
});
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const cancelAppointmentSchema = z.object({
  reason: z.string().trim().min(3, 'Nhập lý do huỷ').max(500),
});
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;

export const myAppointmentsQuerySchema = z.object({
  scope: z.enum(['upcoming', 'past']).default('upcoming'),
});
export type MyAppointmentsQuery = z.infer<typeof myAppointmentsQuerySchema>;

export const facilityAppointmentsQuerySchema = z.object({
  date: z.iso.date('Ngày không hợp lệ (YYYY-MM-DD)'),
  status: z.enum(AppointmentStatus).optional(),
  /** Chỉ ADMIN mới cần truyền; nhân viên luôn xem cơ sở của mình */
  facilityId: z.uuid().optional(),
});
export type FacilityAppointmentsQuery = z.infer<typeof facilityAppointmentsQuerySchema>;
