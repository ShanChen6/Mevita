import { addMinutes, dayOfWeek, vnStartOfDay } from '../common/vn-time.js';

/** Quy tắc đặt lịch. */
export const BOOKING_RULES = {
  /** Phải đặt trước giờ khám tối thiểu (phút) */
  minLeadMinutes: 30,
  /** Đặt trước tối đa (ngày) */
  maxDaysAhead: 30,
  /** Số lịch hẹn còn hiệu lực tối đa của một bệnh nhân */
  maxActivePerPatient: 5,
} as const;

export interface OpeningSession {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

export interface Slot {
  startAt: string;
  endAt: string;
  /** Số chỗ còn trống */
  remaining: number;
  available: boolean;
}

export interface SlotInput {
  /** Ngày `YYYY-MM-DD` (giờ Việt Nam) */
  date: string;
  sessions: OpeningSession[];
  slotMinutes: number;
  /** Số bệnh nhân tối đa mỗi khung */
  capacity: number;
  /** Số lịch đã đặt theo thời điểm bắt đầu (ISO) */
  booked: Map<string, number>;
  now: Date;
  minLeadMinutes?: number;
}

/**
 * Sinh các khung giờ khám trong một ngày từ giờ làm việc của cơ sở.
 * Khung chỉ được tạo khi nằm trọn trong ca; khung đã qua hoặc quá sát giờ thì không đặt được.
 */
export function generateSlots({
  date,
  sessions,
  slotMinutes,
  capacity,
  booked,
  now,
  minLeadMinutes = BOOKING_RULES.minLeadMinutes,
}: SlotInput): Slot[] {
  const dow = dayOfWeek(date);
  const midnight = vnStartOfDay(date);
  const earliest = addMinutes(now, minLeadMinutes);
  const slots: Slot[] = [];

  const todays = sessions
    .filter((s) => s.dayOfWeek === dow)
    .sort((a, b) => a.startMinute - b.startMinute);

  for (const session of todays) {
    for (let m = session.startMinute; m + slotMinutes <= session.endMinute; m += slotMinutes) {
      const start = addMinutes(midnight, m);
      const startAt = start.toISOString();
      const remaining = Math.max(0, capacity - (booked.get(startAt) ?? 0));
      slots.push({
        startAt,
        endAt: addMinutes(start, slotMinutes).toISOString(),
        remaining,
        available: remaining > 0 && start >= earliest,
      });
    }
  }
  return slots;
}
