import { listCommunesQuerySchema, provinceCodeSchema } from './administrative-units.schemas.js';

describe('administrative-units schemas', () => {
  it('chấp nhận mã tỉnh 2 chữ số', () => {
    expect(provinceCodeSchema.safeParse('15').success).toBe(true);
    expect(provinceCodeSchema.safeParse('1').success).toBe(false);
    expect(provinceCodeSchema.safeParse('ab').success).toBe(false);
  });

  it('áp dụng limit mặc định và ép kiểu số', () => {
    expect(listCommunesQuerySchema.parse({}).limit).toBe(50);
    expect(listCommunesQuerySchema.parse({ limit: '10' }).limit).toBe(10);
  });

  it('từ chối loại xã không hợp lệ', () => {
    expect(listCommunesQuerySchema.safeParse({ type: 'DISTRICT' }).success).toBe(false);
  });
});
