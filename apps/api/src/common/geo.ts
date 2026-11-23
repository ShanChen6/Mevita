/** Tính toán địa lý cho theo dõi xe chuyển viện (không cần dịch vụ bản đồ ngoài). */

export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Khoảng cách đường chim bay (km), công thức haversine. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Đường bộ thực tế dài hơn đường chim bay (đèo dốc, quanh co) — hệ số ước lượng. */
export const ROAD_FACTOR = 1.35;
/** Tốc độ mặc định của xe cứu thương khi chưa đo được (km/h). */
export const DEFAULT_SPEED_KMH = 40;
const MIN_SPEED_KMH = 15;
const MAX_SPEED_KMH = 90;

/** Số phút ước tính để đi quãng đường chim bay `km` với tốc độ `speedKmh` (đã nhân hệ số đường bộ). */
export function travelMinutes(km: number, speedKmh = DEFAULT_SPEED_KMH): number {
  const v = Math.min(MAX_SPEED_KMH, Math.max(MIN_SPEED_KMH, speedKmh));
  return Math.max(1, Math.round(((km * ROAD_FACTOR) / v) * 60));
}

export const hasCoords = (
  f: { latitude: number | null; longitude: number | null } | null | undefined,
): f is LatLng => f?.latitude != null && f.longitude != null;
