import { updateMyProfileSchema } from './patients.schemas.js';

describe('updateMyProfileSchema', () => {
  it('chuẩn hoá BHYT, số điện thoại; chuỗi rỗng thành null', () => {
    const v = updateMyProfileSchema.parse({
      healthInsuranceNumber: ' dn 4010090001234 ',
      phone: '+84 912 345 678',
      allergies: '',
      nationalId: '',
    });
    expect(v).toEqual({
      healthInsuranceNumber: 'DN4010090001234',
      phone: '0912345678',
      allergies: null,
      nationalId: null,
    });
  });

  it('ngày và mã xã để trống được hiểu là xoá (null)', () => {
    expect(updateMyProfileSchema.parse({ healthInsuranceExpiry: '', communeCode: '' })).toEqual({
      healthInsuranceExpiry: null,
      communeCode: null,
    });
  });

  it('chỉ giữ các trường được gửi lên', () => {
    expect(updateMyProfileSchema.parse({ bloodType: 'O_POSITIVE' })).toEqual({
      bloodType: 'O_POSITIVE',
    });
  });

  it.each([
    [{ nationalId: '123' }],
    [{ dateOfBirth: '2999-01-01' }],
    [{ communeCode: 'abc' }],
    [{ healthInsuranceNumber: 'x' }],
    [{ bloodType: 'Z' }],
  ])('từ chối %j', (input) => {
    expect(updateMyProfileSchema.safeParse(input).success).toBe(false);
  });
});
