import { generateSlots, type OpeningSession } from './slots.js';

// Thứ Tư 02/12/2026: ca sáng 07:30–09:00, ca chiều 13:30–14:15
const sessions: OpeningSession[] = [
  { dayOfWeek: 3, startMinute: 450, endMinute: 540 },
  { dayOfWeek: 3, startMinute: 810, endMinute: 855 },
  { dayOfWeek: 4, startMinute: 450, endMinute: 690 },
];
const base = {
  date: '2026-12-02',
  sessions,
  slotMinutes: 30,
  capacity: 2,
  booked: new Map<string, number>(),
  now: new Date('2026-12-01T00:00:00Z'),
};

describe('generateSlots', () => {
  it('chia ca thành khung theo giờ Việt Nam, bỏ phần lẻ cuối ca', () => {
    const slots = generateSlots(base);
    expect(slots.map((s) => s.startAt)).toEqual([
      '2026-12-02T00:30:00.000Z', // 07:30
      '2026-12-02T01:00:00.000Z', // 08:00
      '2026-12-02T01:30:00.000Z', // 08:30
      '2026-12-02T06:30:00.000Z', // 13:30 (14:00–14:30 vượt quá 14:15)
    ]);
    expect(slots[0].endAt).toBe('2026-12-02T01:00:00.000Z');
    expect(slots.every((s) => s.available && s.remaining === 2)).toBe(true);
  });

  it('trừ số chỗ đã đặt, hết chỗ thì không đặt được', () => {
    const booked = new Map([
      ['2026-12-02T00:30:00.000Z', 1],
      ['2026-12-02T01:00:00.000Z', 2],
    ]);
    const [a, b] = generateSlots({ ...base, booked });
    expect(a).toMatchObject({ remaining: 1, available: true });
    expect(b).toMatchObject({ remaining: 0, available: false });
  });

  it('khung đã qua hoặc sát giờ (< 30 phút) không đặt được', () => {
    // Bây giờ là 07:45 giờ VN → 07:30 đã qua, 08:00 còn 15 phút (quá sát), 08:30 được
    const slots = generateSlots({ ...base, now: new Date('2026-12-02T00:45:00Z') });
    expect(slots.slice(0, 3).map((s) => s.available)).toEqual([false, false, true]);
  });

  it('ngày cơ sở nghỉ thì không có khung', () => {
    expect(generateSlots({ ...base, date: '2026-12-06' })).toEqual([]); // Chủ nhật
  });
});
