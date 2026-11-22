/**
 * Thời gian theo giờ Việt Nam (UTC+7, không có giờ mùa hè).
 * Lưu trữ trong DB luôn là UTC; các hàm này dùng khi cần "ngày/giờ địa phương".
 */
export const VN_OFFSET_MINUTES = 7 * 60;
const MS_PER_MINUTE = 60_000;

/** 00:00 giờ Việt Nam của ngày `YYYY-MM-DD`, dạng Date (UTC). */
export function vnStartOfDay(date: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) - VN_OFFSET_MINUTES * MS_PER_MINUTE);
}

/** Ngày `YYYY-MM-DD` theo giờ Việt Nam của một thời điểm. */
export function vnDateOf(instant: Date): string {
  return new Date(instant.getTime() + VN_OFFSET_MINUTES * MS_PER_MINUTE).toISOString().slice(0, 10);
}

/** Thứ trong tuần (0 = Chủ nhật) của ngày `YYYY-MM-DD`. */
export function dayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Số phút tính từ 00:00 giờ Việt Nam. */
export function vnMinuteOfDay(instant: Date): number {
  const local = new Date(instant.getTime() + VN_OFFSET_MINUTES * MS_PER_MINUTE);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

export const addMinutes = (d: Date, minutes: number) =>
  new Date(d.getTime() + minutes * MS_PER_MINUTE);

/** Cộng `days` ngày vào chuỗi `YYYY-MM-DD`. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
