import { addDays, dayOfWeek, vnDateOf, vnMinuteOfDay, vnStartOfDay } from './vn-time.js';

describe('vn-time', () => {
  it('00:00 giờ VN = 17:00 UTC ngày hôm trước', () => {
    expect(vnStartOfDay('2026-12-02').toISOString()).toBe('2026-12-01T17:00:00.000Z');
  });

  it('ngày & phút theo giờ VN', () => {
    const t = new Date('2026-12-01T18:30:00Z'); // 01:30 ngày 02/12 giờ VN
    expect(vnDateOf(t)).toBe('2026-12-02');
    expect(vnMinuteOfDay(t)).toBe(90);
  });

  it('thứ trong tuần và cộng ngày qua tháng/năm', () => {
    expect(dayOfWeek('2026-12-06')).toBe(0);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
