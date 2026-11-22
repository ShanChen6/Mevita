import { loginSchema, normalizePhone, registerSchema } from './auth.schemas.js';

describe('auth schemas', () => {
  it.each([
    ['0912 345 678', '0912345678'],
    ['+84912345678', '0912345678'],
    ['84912345678', '0912345678'],
    ['0912.345.678', '0912345678'],
  ])('chuẩn hoá số điện thoại %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  const base = {
    fullName: 'Lò Văn Cường',
    password: 'Mevita2026',
    dateOfBirth: '1990-05-01',
    gender: 'MALE',
  };

  it('yêu cầu email hoặc số điện thoại', () => {
    expect(registerSchema.safeParse(base).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, phone: '+84 912 345 678' }).data?.phone).toBe(
      '0912345678',
    );
  });

  it('báo thiếu liên hệ cùng lúc với các lỗi trường khác', () => {
    const r = registerSchema.safeParse({ ...base, password: 'short' });
    const paths = r.error?.issues.map((i) => i.path.join('.'));
    expect(paths).toEqual(expect.arrayContaining(['password', 'phone']));
  });

  it('kiểm tra độ mạnh mật khẩu và CCCD', () => {
    expect(
      registerSchema.safeParse({ ...base, phone: '0912345678', password: 'abcdefgh' }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({ ...base, phone: '0912345678', nationalId: '123' }).success,
    ).toBe(false);
  });

  it('chuẩn hoá email về chữ thường', () => {
    expect(registerSchema.parse({ ...base, email: ' An@Mevita.VN ' }).email).toBe('an@mevita.vn');
    expect(loginSchema.safeParse({ identifier: 'an@mevita.vn', password: 'x' }).success).toBe(true);
  });
});
