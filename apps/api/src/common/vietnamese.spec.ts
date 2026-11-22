import { toCodeName } from './vietnamese.js';

describe('toCodeName', () => {
  it.each([
    ['Mường Khương', 'muong_khuong'],
    ['Đắk Lắk', 'dak_lak'],
    ['  Thành phố   Hồ Chí Minh ', 'thanh_pho_ho_chi_minh'],
    ['muong khuong', 'muong_khuong'],
    ['Phường 1', 'phuong_1'],
    ['Thanh Hoá', 'thanh_hoa'],
  ])('%s -> %s', (input, expected) => {
    expect(toCodeName(input)).toBe(expected);
  });
});
