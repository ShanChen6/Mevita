import { z } from 'zod';

/** Kiểm tra phía trình duyệt cho form hồ sơ — API kiểm tra lại toàn bộ. */
export const profileFormSchema = z.object({
  fullName: z.string().trim().min(2, 'Nhập họ và tên').max(150),
  dateOfBirth: z.iso.date('Chọn ngày sinh'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  nationalId: z.union([z.literal(''), z.string().regex(/^\d{12}$/, 'Số CCCD gồm đúng 12 chữ số')]),
  healthInsuranceNumber: z.union([
    z.literal(''),
    z.string().regex(/^[A-Za-z0-9\s]{10,18}$/, 'Mã thẻ BHYT gồm 10–15 ký tự chữ và số'),
  ]),
  healthInsuranceExpiry: z.union([z.literal(''), z.iso.date()]),
  phone: z.union([
    z.literal(''),
    z.string().regex(/^(\+?84|0)[\d\s.]{9,12}$/, 'Số điện thoại không hợp lệ'),
  ]),
  provinceCode: z.string(),
  communeCode: z.string(),
  addressDetail: z.string().max(255),
  bloodType: z.enum([
    'A_POSITIVE',
    'A_NEGATIVE',
    'B_POSITIVE',
    'B_NEGATIVE',
    'AB_POSITIVE',
    'AB_NEGATIVE',
    'O_POSITIVE',
    'O_NEGATIVE',
    'UNKNOWN',
  ]),
  allergies: z.string().max(2000),
  chronicConditions: z.string().max(2000),
  emergencyContactName: z.string().max(150),
  emergencyContactPhone: z.union([
    z.literal(''),
    z.string().regex(/^(\+?84|0)[\d\s.]{9,12}$/, 'Số điện thoại không hợp lệ'),
  ]),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
