import { z } from 'zod';
import { EncounterType } from '../generated/prisma/enums.js';

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

/** Số nguyên trong ngưỡng sinh lý ghi nhận được (khớp ràng buộc CHECK trong DB). */
const intIn = (min: number, max: number, label: string) =>
  z
    .number({ error: `${label} phải là số` })
    .int(`${label} phải là số nguyên`)
    .min(min, `${label} không hợp lệ (${min}–${max})`)
    .max(max, `${label} không hợp lệ (${min}–${max})`)
    .nullish()
    .transform((v) => v ?? null);

const numIn = (min: number, max: number, label: string) =>
  z
    .number({ error: `${label} phải là số` })
    .min(min, `${label} không hợp lệ (${min}–${max})`)
    .max(max, `${label} không hợp lệ (${min}–${max})`)
    .nullish()
    .transform((v) => v ?? null);

export const diagnosisInputSchema = z.object({
  icdCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]\d{2}(\.\d{1,2})?$/, 'Mã ICD-10 không hợp lệ'),
  isPrimary: z.boolean().default(false),
  note: text(500),
});

export const prescriptionItemSchema = z.object({
  drugName: z.string().trim().min(1, 'Nhập tên thuốc').max(255),
  activeIngredient: text(255),
  strength: text(50),
  quantity: z.number().positive('Số lượng phải lớn hơn 0').max(10_000),
  unit: z.string().trim().min(1, 'Nhập đơn vị').max(30),
  instructions: z.string().trim().min(1, 'Nhập cách dùng').max(500),
  durationDays: z
    .number()
    .int()
    .min(1)
    .max(365)
    .nullish()
    .transform((v) => v ?? null),
});

/** Cập nhật phiếu khám nháp. Danh sách chẩn đoán/thuốc gửi lên sẽ thay thế toàn bộ danh sách cũ. */
export const updateRecordSchema = z
  .object({
    encounterType: z.enum(EncounterType),
    specialtyId: z.uuid().nullable(),
    chiefComplaint: z.string().trim().min(2, 'Nhập lý do khám').max(500),
    symptoms: text(5000),
    physicalExamination: text(5000),
    pulse: intIn(20, 250, 'Mạch'),
    temperature: numIn(30, 43, 'Nhiệt độ'),
    systolicBp: intIn(40, 300, 'Huyết áp tâm thu'),
    diastolicBp: intIn(20, 200, 'Huyết áp tâm trương'),
    respiratoryRate: intIn(4, 80, 'Nhịp thở'),
    spo2: intIn(40, 100, 'SpO2'),
    weightKg: numIn(0.3, 400, 'Cân nặng'),
    heightCm: numIn(20, 250, 'Chiều cao'),
    diagnosisNote: text(5000),
    treatmentPlan: text(5000),
    followUpDate: z
      .union([z.literal(''), z.iso.date('Ngày tái khám không hợp lệ')])
      .nullish()
      .transform((v) => v || null),
    diagnoses: z.array(diagnosisInputSchema).max(10, 'Tối đa 10 chẩn đoán'),
    prescriptionItems: z.array(prescriptionItemSchema).max(30, 'Tối đa 30 loại thuốc'),
  })
  .partial()
  .refine(
    (v) => !v.diagnoses || new Set(v.diagnoses.map((d) => d.icdCode)).size === v.diagnoses.length,
    {
      message: 'Mã ICD-10 bị trùng',
      path: ['diagnoses'],
    },
  )
  .refine((v) => !v.diagnoses || v.diagnoses.filter((d) => d.isPrimary).length <= 1, {
    message: 'Chỉ được chọn một bệnh chính',
    path: ['diagnoses'],
  })
  .refine((v) => v.systolicBp == null || v.diastolicBp == null || v.systolicBp > v.diastolicBp, {
    message: 'Huyết áp tâm thu phải lớn hơn tâm trương',
    path: ['systolicBp'],
  });
export type UpdateRecordInput = z.infer<typeof updateRecordSchema>;

export const signRecordSchema = z.object({
  /** Nhập lại mật khẩu để xác nhận chữ ký */
  password: z.string().min(1, 'Nhập mật khẩu để ký').max(128),
});
export type SignRecordInput = z.infer<typeof signRecordSchema>;
