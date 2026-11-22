import { z } from 'zod';
import { Gender } from '../generated/prisma/enums.js';

/** Chuẩn hoá số điện thoại Việt Nam về dạng 0xxxxxxxxx. */
export function normalizePhone(input: string): string {
  const digits = input.replace(/[\s.\-()]/g, '');
  return digits.startsWith('+84')
    ? `0${digits.slice(3)}`
    : digits.startsWith('84') && digits.length === 11
      ? `0${digits.slice(2)}`
      : digits;
}

const phoneSchema = z
  .string()
  .trim()
  .transform(normalizePhone)
  .pipe(z.string().regex(/^0\d{9}$/, 'Số điện thoại không hợp lệ'));

const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Email không hợp lệ'));

const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu tối thiểu 8 ký tự')
  .max(128)
  .regex(/[A-Za-z]/, 'Mật khẩu cần có chữ cái')
  .regex(/\d/, 'Mật khẩu cần có chữ số');

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Họ tên quá ngắn').max(150),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    password: passwordSchema,
    dateOfBirth: z.iso.date('Ngày sinh không hợp lệ (YYYY-MM-DD)'),
    gender: z.enum(Gender),
    nationalId: z
      .string()
      .trim()
      .regex(/^\d{12}$/, 'Số CCCD gồm đúng 12 chữ số')
      .optional(),
  })
  .refine((v) => v.email || v.phone, {
    message: 'Cần email hoặc số điện thoại',
    path: ['phone'],
    // Chạy cả khi trường khác lỗi để trả về đủ lỗi trong một lần
    when: () => true,
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  /** Email hoặc số điện thoại */
  identifier: z.string().trim().min(3).max(255),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(200),
});
export type RefreshInput = z.infer<typeof refreshSchema>;
