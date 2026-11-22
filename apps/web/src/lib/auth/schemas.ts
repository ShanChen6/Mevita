import { z } from 'zod';

export const loginFormSchema = z.object({
  identifier: z.string().trim().min(3, 'Nhập email hoặc số điện thoại'),
  password: z.string().min(1, 'Nhập mật khẩu'),
  next: z.string().optional(),
});

const always = () => true;

export const registerFormSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Nhập họ và tên'),
    email: z.union([z.literal(''), z.email('Email không hợp lệ')]),
    phone: z.union([
      z.literal(''),
      z.string().regex(/^(\+?84|0)[\d\s.]{9,12}$/, 'Số điện thoại không hợp lệ'),
    ]),
    password: z
      .string()
      .min(8, 'Mật khẩu tối thiểu 8 ký tự')
      .regex(/[A-Za-z]/, 'Mật khẩu cần có chữ cái')
      .regex(/\d/, 'Mật khẩu cần có chữ số'),
    confirmPassword: z.string(),
    dateOfBirth: z.iso.date('Chọn ngày sinh'),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER'], 'Chọn giới tính'),
    nationalId: z.union([
      z.literal(''),
      z.string().regex(/^\d{12}$/, 'Số CCCD gồm đúng 12 chữ số'),
    ]),
  })
  // `when: always` — chạy kiểm tra liên trường kể cả khi trường khác đang lỗi,
  // để người dùng thấy toàn bộ lỗi trong một lần gửi
  .refine((v) => v.email || v.phone, {
    message: 'Cần email hoặc số điện thoại',
    path: ['phone'],
    when: always,
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Mật khẩu nhập lại không khớp',
    path: ['confirmPassword'],
    when: always,
  });

export interface FormState {
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
}
