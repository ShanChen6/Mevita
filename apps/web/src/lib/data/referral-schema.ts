import { z } from 'zod';

/** Form lệnh chuyển tuyến — kiểm tra ở trình duyệt và Server Action; API kiểm tra lại. */
export const referralFormSchema = z
  .object({
    sourceRecordId: z.uuid(),
    toFacilityId: z.uuid('Chọn bệnh viện tuyến trên'),
    priority: z.enum(['CRITICAL', 'URGENT', 'ROUTINE']),
    reason: z.string().trim().min(5, 'Nhập lý do chuyển tuyến').max(1000),
    clinicalSummary: z.string().trim().min(10, 'Nhập tóm tắt bệnh án').max(5000),
    initialTreatment: z.string().trim().max(5000),
    escortId: z.string(),
    vehicleInfo: z.string().trim().max(100),
    etaMinutes: z
      .number({ error: 'Nhập thời gian dự kiến' })
      .int()
      .min(5, 'Tối thiểu 5 phút')
      .max(600, 'Tối đa 600 phút')
      .or(z.nan())
      .optional(),
    transportMode: z.enum(['FACILITY_VEHICLE', 'PICKUP', 'EMS_115', 'FAMILY', 'OTHER']),
    vehicleId: z.string(),
    transportNote: z.string().trim().max(500),
    requiredSpecialtyCode: z.string(),
  })
  .refine(
    (v) =>
      v.transportMode === 'PICKUP' ||
      (typeof v.etaMinutes === 'number' && !Number.isNaN(v.etaMinutes)),
    {
      message: 'Nhập thời gian dự kiến xe tới',
      path: ['etaMinutes'],
    },
  )
  .refine((v) => v.transportMode !== 'FACILITY_VEHICLE' || !!v.vehicleId, {
    message: 'Chọn xe của cơ sở',
    path: ['vehicleId'],
  });
export type ReferralFormValues = z.infer<typeof referralFormSchema>;
