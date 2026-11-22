import { z } from 'zod';
import { normalizePhone } from '../auth/auth.schemas.js';
import { BloodType, Gender } from '../generated/prisma/enums.js';

/** Chuỗi tuỳ chọn: chuỗi rỗng được hiểu là xoá giá trị (null). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const optionalPhone = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? normalizePhone(v) : null))
  .pipe(
    z
      .string()
      .regex(/^0\d{9}$/, 'Số điện thoại không hợp lệ')
      .nullable(),
  );

/** Các trường hồ sơ bệnh nhân (dùng chung cho cập nhật và tạo mới). */
const profileFields = z.object({
  fullName: z.string().trim().min(2).max(150),
  dateOfBirth: z.iso.date('Ngày sinh không hợp lệ'),
  gender: z.enum(Gender),
  nationalId: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v : null))
    .pipe(
      z
        .string()
        .regex(/^\d{12}$/, 'Số CCCD gồm đúng 12 chữ số')
        .nullable(),
    ),
  healthInsuranceNumber: z
    .string()
    .trim()
    .toUpperCase()
    .nullish()
    .transform((v) => (v ? v.replace(/\s/g, '') : null))
    .pipe(
      z
        .string()
        .regex(/^[A-Z0-9]{10,15}$/, 'Mã thẻ BHYT gồm 10–15 ký tự chữ và số')
        .nullable(),
    ),
  healthInsuranceExpiry: z
    .union([z.literal(''), z.iso.date('Hạn thẻ BHYT không hợp lệ')])
    .nullish()
    .transform((v) => v || null),
  phone: optionalPhone,
  communeCode: z
    .union([z.literal(''), z.string().regex(/^\d{5}$/, 'Mã xã không hợp lệ')])
    .nullish()
    .transform((v) => v || null),
  addressDetail: optionalText(255),
  bloodType: z.enum(BloodType),
  allergies: optionalText(2000),
  chronicConditions: optionalText(2000),
  emergencyContactName: optionalText(150),
  emergencyContactPhone: optionalPhone,
});

const validDob = (v: { dateOfBirth?: string }) => {
  if (!v.dateOfBirth) return true;
  const dob = new Date(v.dateOfBirth);
  return dob <= new Date() && dob.getFullYear() >= 1900;
};

/** Bệnh nhân tự cập nhật hồ sơ sức khoẻ. Chỉ các trường gửi lên mới được cập nhật. */
export const updateMyProfileSchema = profileFields
  .partial()
  .refine(validDob, { message: 'Ngày sinh không hợp lệ', path: ['dateOfBirth'] });
export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;

export const listRecordsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  /** id hồ sơ cuối cùng của trang trước */
  cursor: z.uuid().optional(),
});
export type ListRecordsQuery = z.infer<typeof listRecordsQuerySchema>;

export const lookupQuerySchema = z.object({
  q: z.string().trim().min(2, 'Nhập ít nhất 2 ký tự').max(100),
});
export type LookupQuery = z.infer<typeof lookupQuerySchema>;

/** Quầy tiếp đón tạo hồ sơ bệnh nhân vãng lai: bắt buộc họ tên, ngày sinh, giới tính. */
export const createPatientSchema = profileFields
  .partial()
  .required({ fullName: true, dateOfBirth: true, gender: true })
  .refine(validDob, { message: 'Ngày sinh không hợp lệ', path: ['dateOfBirth'] });
export type CreatePatientInput = z.infer<typeof createPatientSchema>;
