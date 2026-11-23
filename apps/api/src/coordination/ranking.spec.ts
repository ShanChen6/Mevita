import { loadLevel } from './capacity.js';
import { rankDestination, type RankInput } from './ranking.js';

const base: RankInput = {
  sameProvince: true,
  onDutyCount: 2,
  specialties: [{ code: 'NEUROSURGERY', name: 'Ngoại thần kinh' }],
  erBedsAvailable: 8,
  icuBedsAvailable: 2,
  load: 'GREEN',
  stale: false,
  travelMinutes: 60,
};
const neuro = { code: 'NEUROSURGERY', name: 'Ngoại thần kinh' };

describe('mức tải bệnh viện', () => {
  const now = new Date('2026-11-23T10:00:00Z');
  const at = new Date('2026-11-23T09:00:00Z');
  it('xanh / vàng / đỏ theo tỉ lệ giường cấp cứu trống', () => {
    expect(loadLevel({ erBedsTotal: 20, erBedsAvailable: 10, capacityUpdatedAt: at }, now)).toEqual(
      { level: 'GREEN', stale: false },
    );
    expect(
      loadLevel({ erBedsTotal: 20, erBedsAvailable: 4, capacityUpdatedAt: at }, now).level,
    ).toBe('YELLOW');
    expect(
      loadLevel({ erBedsTotal: 20, erBedsAvailable: 1, capacityUpdatedAt: at }, now).level,
    ).toBe('RED');
    expect(
      loadLevel({ erBedsTotal: 20, erBedsAvailable: 0, capacityUpdatedAt: at }, now).level,
    ).toBe('RED');
  });
  it('chưa khai báo → UNKNOWN; quá 12 giờ → cũ', () => {
    expect(
      loadLevel({ erBedsTotal: null, erBedsAvailable: null, capacityUpdatedAt: null }, now),
    ).toEqual({ level: 'UNKNOWN', stale: true });
    expect(
      loadLevel(
        {
          erBedsTotal: 10,
          erBedsAvailable: 5,
          capacityUpdatedAt: new Date('2026-11-22T20:00:00Z'),
        },
        now,
      ).stale,
    ).toBe(true);
  });
});

describe('chấm điểm bệnh viện đích', () => {
  it('có chuyên khoa cần thắng bệnh viện gần hơn nhưng không có', () => {
    const near = rankDestination(
      { ...base, specialties: [], travelMinutes: 20 },
      { priority: 'CRITICAL', specialty: neuro },
    );
    const far = rankDestination(
      { ...base, travelMinutes: 70 },
      { priority: 'CRITICAL', specialty: neuro },
    );
    expect(far.score).toBeGreaterThan(near.score);
    expect(near.warnings).toContain('Không có Ngoại thần kinh');
    expect(far.reasons).toContain('Có Ngoại thần kinh');
  });
  it('quá tải bị xếp sau nhưng vẫn có điểm (không bị loại), có cảnh báo', () => {
    const ok = rankDestination(base, { priority: 'URGENT' });
    const full = rankDestination(
      { ...base, load: 'RED', erBedsAvailable: 0 },
      { priority: 'URGENT' },
    );
    expect(full.score).toBeLessThan(ok.score);
    expect(full.warnings.join()).toMatch(/quá tải/);
  });
  it('ca tối khẩn ưu tiên thời gian di chuyển hơn ca thường', () => {
    const d = (p: 'CRITICAL' | 'ROUTINE') =>
      rankDestination({ ...base, travelMinutes: 120 }, { priority: p }).score -
      rankDestination({ ...base, travelMinutes: 30 }, { priority: p }).score;
    expect(Math.abs(d('CRITICAL'))).toBeGreaterThan(Math.abs(d('ROUTINE')));
  });
  it('ca tối khẩn: hết giường hồi sức và không ai trực bị trừ điểm', () => {
    const r = rankDestination(
      { ...base, icuBedsAvailable: 0, onDutyCount: 0 },
      { priority: 'CRITICAL' },
    );
    expect(r.warnings).toEqual(
      expect.arrayContaining(['Hết giường hồi sức', 'Chưa có bác sĩ trực trực tuyến']),
    );
  });
  it('bệnh viện chưa có toạ độ không được xếp trên bệnh viện gần đã biết khoảng cách', () => {
    const known = rankDestination({ ...base, travelMinutes: 45 }, { priority: 'URGENT' });
    const unknown = rankDestination({ ...base, travelMinutes: null }, { priority: 'URGENT' });
    expect(known.score).toBeGreaterThan(unknown.score);
    expect(unknown.warnings.join()).toMatch(/toạ độ/);
  });
});
