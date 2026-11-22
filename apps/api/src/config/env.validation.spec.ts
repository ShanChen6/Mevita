import { validateEnv } from './env.validation.js';

describe('validateEnv', () => {
  const base = { DATABASE_URL: 'postgresql://mevita:mevita@localhost:5432/mevita' };

  it('áp dụng giá trị mặc định', () => {
    const env = validateEnv(base);
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.CLOUDINARY_CLOUD_NAME).toBeUndefined();
  });

  it('coi chuỗi rỗng của Cloudinary là chưa cấu hình', () => {
    const env = validateEnv({ ...base, CLOUDINARY_API_KEY: '' });
    expect(env.CLOUDINARY_API_KEY).toBeUndefined();
  });

  it('báo lỗi khi thiếu DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });
});
