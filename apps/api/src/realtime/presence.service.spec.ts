import { PresenceService } from './presence.service.js';
import type { SocketUser } from './realtime.events.js';

const user = (id: string, facilityId: string | null = 'f1'): SocketUser => ({
  id,
  role: 'PROVINCE_STAFF',
  facilityId,
  fullName: `BS ${id}`,
  academicTitle: null,
});

describe('PresenceService', () => {
  it('đếm nhiều tab của cùng một người, chỉ rời trực khi đóng tab cuối', () => {
    const p = new PresenceService();
    expect(p.join(user('a'))).toBe(true);
    expect(p.join(user('a'))).toBe(false); // tab thứ 2
    expect(p.onDuty('f1')).toEqual([expect.objectContaining({ userId: 'a', connections: 2 })]);
    expect(p.leave(user('a'))).toBe(false);
    expect(p.isStaffed('f1')).toBe(true);
    expect(p.leave(user('a'))).toBe(true);
    expect(p.isStaffed('f1')).toBe(false);
  });

  it('tách theo cơ sở; người không có cơ sở (bệnh nhân) không tính', () => {
    const p = new PresenceService();
    p.join(user('a', 'f1'));
    p.join(user('b', 'f2'));
    expect(p.join(user('c', null))).toBe(false);
    expect(p.onDuty('f1').map((s) => s.userId)).toEqual(['a']);
    expect(p.onDuty('f2').map((s) => s.userId)).toEqual(['b']);
    expect(p.leave(user('zzz'))).toBe(false);
  });
});
