import type { ReferralPriority } from '../generated/prisma/enums.js';
import type { LoadLevel } from './capacity.js';

export interface RankInput {
  sameProvince: boolean;
  onDutyCount: number;
  specialties: { code: string; name: string }[];
  erBedsAvailable: number | null;
  icuBedsAvailable: number | null;
  load: LoadLevel;
  stale: boolean;
  travelMinutes: number | null;
}

export interface RankResult {
  score: number;
  /** Điểm mạnh — hiển thị cho bác sĩ tuyến dưới */
  reasons: string[];
  /** Điểm cần lưu ý — vẫn chọn được, bệnh viện không được từ chối ca cấp cứu */
  warnings: string[];
}

/**
 * Chấm điểm bệnh viện đích cho một ca (Task B). Không loại bệnh viện nào — quá tải chỉ bị xếp sau.
 * Trọng số: chuyên khoa cần > thời gian di chuyển (ca tối khẩn nặng hơn) > giường trống > bác sĩ đang trực
 * > cùng tỉnh (tuyến chuyên môn kỹ thuật thông thường).
 */
export function rankDestination(
  c: RankInput,
  opts: { priority: ReferralPriority; specialty?: { code: string; name: string } | null },
): RankResult {
  let score = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (opts.specialty) {
    if (c.specialties.some((s) => s.code === opts.specialty!.code)) {
      score += 40;
      reasons.push(`Có ${opts.specialty.name}`);
    } else {
      score -= 60;
      warnings.push(`Không có ${opts.specialty.name}`);
    }
  }

  if (c.travelMinutes != null) {
    score -=
      c.travelMinutes *
      (opts.priority === 'CRITICAL' ? 0.5 : opts.priority === 'URGENT' ? 0.3 : 0.1);
    reasons.push(`~${c.travelMinutes} phút di chuyển`);
  } else {
    // Không biết khoảng cách thì không được lợi thế so với bệnh viện đã biết là gần
    score -= 30;
    warnings.push('Chưa có toạ độ — không ước tính được thời gian di chuyển');
  }

  if (c.load === 'UNKNOWN' || c.stale) {
    score -= 5;
    warnings.push(c.load === 'UNKNOWN' ? 'Chưa cập nhật số giường' : 'Số liệu giường đã cũ');
  }
  if (c.load === 'GREEN') {
    score += 15;
    reasons.push(`Còn ${c.erBedsAvailable} giường cấp cứu`);
  } else if (c.load === 'YELLOW') {
    reasons.push(`Còn ${c.erBedsAvailable} giường cấp cứu (đông)`);
  } else if (c.load === 'RED') {
    score -= 30;
    warnings.push(`Đang quá tải (còn ${c.erBedsAvailable ?? 0} giường cấp cứu)`);
  }
  if (opts.priority === 'CRITICAL' && c.icuBedsAvailable === 0) {
    score -= 15;
    warnings.push('Hết giường hồi sức');
  }

  if (c.onDutyCount > 0) {
    score += 15;
    reasons.push(`${c.onDutyCount} bác sĩ đang trực`);
  } else {
    score -= 10;
    warnings.push('Chưa có bác sĩ trực trực tuyến');
  }

  if (c.sameProvince) score += 10;
  return { score: Math.round(score * 10) / 10, reasons, warnings };
}
