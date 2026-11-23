import { hasCoords, haversineKm, travelMinutes } from './geo.js';
import { belowRecommendation } from '../referrals/transport.js';

describe('geo', () => {
  it('khoảng cách Mường Khương → TP Lào Cai ~41 km, Lào Cai → Hà Nội ~245 km (đường chim bay)', () => {
    const mk = { latitude: 22.7676, longitude: 104.1236 };
    const lc = { latitude: 22.4127, longitude: 104.0226 };
    const hn = { latitude: 21.0285, longitude: 105.8472 };
    expect(haversineKm(mk, lc)).toBeCloseTo(40.9, 0);
    expect(haversineKm(lc, hn)).toBeGreaterThan(230);
    expect(haversineKm(lc, hn)).toBeLessThan(260);
    expect(haversineKm(mk, mk)).toBe(0);
  });

  it('thời gian di chuyển: hệ số đường bộ 1,35, tốc độ kẹp 15–90 km/h, tối thiểu 1 phút', () => {
    expect(travelMinutes(40)).toBe(81); // 54 km đường bộ / 40 km/h
    expect(travelMinutes(40, 500)).toBe(36); // kẹp 90 km/h
    expect(travelMinutes(40, 1)).toBe(216); // kẹp 15 km/h
    expect(travelMinutes(0)).toBe(1);
  });

  it('hasCoords', () => {
    expect(hasCoords({ latitude: 1, longitude: 2 })).toBe(true);
    expect(hasCoords({ latitude: null, longitude: 2 })).toBe(false);
    expect(hasCoords(null)).toBe(false);
  });
});

describe('khuyến nghị phương tiện theo mức độ', () => {
  it('tối khẩn/khẩn: xe cứu thương, xe đón, 115 hợp lệ; xe thường, gia đình, khác là dưới khuyến nghị', () => {
    for (const p of ['CRITICAL', 'URGENT'] as const) {
      expect(belowRecommendation(p, 'FACILITY_VEHICLE', 'ADVANCED_AMBULANCE')).toBe(false);
      expect(belowRecommendation(p, 'FACILITY_VEHICLE', 'BASIC_AMBULANCE')).toBe(false);
      expect(belowRecommendation(p, 'PICKUP', null)).toBe(false);
      expect(belowRecommendation(p, 'EMS_115', null)).toBe(false);
      expect(belowRecommendation(p, 'FACILITY_VEHICLE', 'TRANSPORT')).toBe(true);
      expect(belowRecommendation(p, 'FAMILY', null)).toBe(true);
      expect(belowRecommendation(p, 'OTHER', null)).toBe(true);
    }
  });
  it('ca thường: phương tiện nào cũng được', () => {
    expect(belowRecommendation('ROUTINE', 'FAMILY', null)).toBe(false);
    expect(belowRecommendation('ROUTINE', 'FACILITY_VEHICLE', 'TRANSPORT')).toBe(false);
  });
});
