import { z } from 'zod';

/** Ô số tuỳ chọn trên form: chuỗi rỗng → null. */
const optNum = (min: number, max: number, label: string, integer = true) =>
  z
    .number({ error: `${label} phải là số` })
    .min(min, `${label}: ${min}–${max}`)
    .max(max, `${label}: ${min}–${max}`)
    .refine((v) => !integer || Number.isInteger(v), `${label} phải là số nguyên`)
    .nullable();

/** Kiểm tra phía trình duyệt cho phiếu khám — API kiểm tra lại toàn bộ. */
export const recordFormSchema = z
  .object({
    encounterType: z.enum(['OUTPATIENT', 'EMERGENCY', 'INPATIENT']),
    specialtyId: z.string(),
    chiefComplaint: z.string().trim().min(2, 'Nhập lý do khám').max(500),
    symptoms: z.string().max(5000),
    physicalExamination: z.string().max(5000),
    pulse: optNum(20, 250, 'Mạch'),
    temperature: optNum(30, 43, 'Nhiệt độ', false),
    systolicBp: optNum(40, 300, 'HA tâm thu'),
    diastolicBp: optNum(20, 200, 'HA tâm trương'),
    respiratoryRate: optNum(4, 80, 'Nhịp thở'),
    spo2: optNum(40, 100, 'SpO2'),
    weightKg: optNum(0.3, 400, 'Cân nặng', false),
    heightCm: optNum(20, 250, 'Chiều cao', false),
    diagnoses: z
      .array(z.object({ icdCode: z.string(), name: z.string(), isPrimary: z.boolean() }))
      .max(10, 'Tối đa 10 chẩn đoán'),
    diagnosisNote: z.string().max(5000),
    prescriptionItems: z
      .array(
        z.object({
          drugName: z.string().trim().min(1, 'Nhập tên thuốc').max(255),
          strength: z.string().max(50),
          quantity: z.number({ error: 'Nhập số lượng' }).positive('Số lượng > 0'),
          unit: z.string().trim().min(1, 'Nhập đơn vị').max(30),
          instructions: z.string().trim().min(1, 'Nhập cách dùng').max(500),
          durationDays: z.number().int().min(1).max(365).nullable(),
        }),
      )
      .max(30),
    treatmentPlan: z.string().max(5000),
    followUpDate: z.string(),
  })
  .refine((v) => v.systolicBp == null || v.diastolicBp == null || v.systolicBp > v.diastolicBp, {
    message: 'HA tâm thu phải lớn hơn tâm trương',
    path: ['systolicBp'],
  });

export type RecordFormValues = z.infer<typeof recordFormSchema>;
