const TZ = 'Asia/Ho_Chi_Minh';

const dateFmt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const timeFmt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** 01/12/2026 */
export const formatDate = (iso: string) => dateFmt.format(new Date(iso));

/** 08:30 */
export const formatTime = (iso: string) => timeFmt.format(new Date(iso));

/** 08:30 · 01/12/2026 */
export const formatDateTime = (iso: string) => `${formatTime(iso)} · ${formatDate(iso)}`;

/** Tuổi tính tại một thời điểm cố định (tránh dùng giờ hiện tại khi render phía server). */
export function ageAt(dateOfBirth: string, at: string) {
  const dob = new Date(dateOfBirth);
  const ref = new Date(at);
  let age = ref.getFullYear() - dob.getFullYear();
  const m = ref.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < dob.getDate())) age--;
  return age;
}

/** 36,8 — số thập phân theo kiểu Việt Nam */
export const formatDecimal = (value: number) =>
  value.toLocaleString('vi-VN', { maximumFractionDigits: 1 });

const weekdayFmt = new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, weekday: 'long' });

/** Thứ Tư */
export const formatWeekday = (iso: string) => {
  const w = weekdayFmt.format(new Date(iso));
  return w.charAt(0).toUpperCase() + w.slice(1);
};

/** 02/12 */
export const formatShortDate = (iso: string) => formatDate(iso).slice(0, 5);

/** Ngày YYYY-MM-DD theo giờ Việt Nam */
export const vnDate = (d: Date = new Date()) =>
  new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

/** Cộng ngày cho chuỗi YYYY-MM-DD */
export function addDaysStr(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Mốc 12:00 trưa giờ VN của ngày YYYY-MM-DD — dùng để định dạng thứ/ngày an toàn múi giờ */
export const vnNoon = (date: string) => `${date}T05:00:00.000Z`;
