/** Mức tải của bệnh viện (Task B) — tính từ giường cấp cứu còn trống do bệnh viện tự cập nhật. */
export type LoadLevel = 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';

/** Số liệu năng lực cũ hơn số giờ này thì coi là chưa cập nhật */
export const CAPACITY_STALE_HOURS = 12;

export interface CapacityFields {
  erBedsTotal: number | null;
  erBedsAvailable: number | null;
  capacityUpdatedAt: Date | null;
}

export function loadLevel(
  f: CapacityFields,
  now = new Date(),
): { level: LoadLevel; stale: boolean } {
  const stale =
    !f.capacityUpdatedAt ||
    now.getTime() - f.capacityUpdatedAt.getTime() > CAPACITY_STALE_HOURS * 3600_000;
  if (f.erBedsTotal == null || f.erBedsAvailable == null || f.erBedsTotal <= 0)
    return { level: 'UNKNOWN', stale };
  const ratio = f.erBedsAvailable / f.erBedsTotal;
  const level = f.erBedsAvailable <= 0 || ratio < 0.1 ? 'RED' : ratio < 0.3 ? 'YELLOW' : 'GREEN';
  return { level, stale };
}
