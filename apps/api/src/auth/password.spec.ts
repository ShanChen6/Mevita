import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('băm và xác minh đúng mật khẩu', async () => {
    const hash = await hashPassword('Mevita@2026');
    expect(hash).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(await verifyPassword('Mevita@2026', hash)).toBe(true);
    expect(await verifyPassword('mevita@2026', hash)).toBe(false);
  });

  it('mỗi lần băm dùng salt khác nhau', async () => {
    expect(await hashPassword('abc12345')).not.toBe(await hashPassword('abc12345'));
  });

  it('từ chối chuỗi băm sai định dạng và chuỗi băm giả', async () => {
    expect(await verifyPassword('x', 'bcrypt$abc')).toBe(false);
    expect(await verifyPassword('x', DUMMY_PASSWORD_HASH)).toBe(false);
  });
});
