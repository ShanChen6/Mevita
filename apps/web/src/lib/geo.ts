/** Ước tính khoảng cách / thời gian di chuyển — cùng công thức với API (apps/api/src/common/geo.ts). */
export interface LatLng {
  latitude: number;
  longitude: number;
}

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

/** Phút đi quãng đường chim bay `km` (×1,35 hệ số đường bộ, mặc định 40 km/h). */
export function travelMinutes(km: number, speedKmh = 40) {
  return Math.max(1, Math.round(((km * 1.35) / Math.min(90, Math.max(15, speedKmh))) * 60));
}

export const hasCoords = (
  f: { latitude: number | null; longitude: number | null } | null | undefined,
): f is LatLng => f?.latitude != null && f.longitude != null;

/** Khuyến nghị phương tiện — cùng quy tắc với API (apps/api/src/referrals/transport.ts). */
export function belowRecommendation(
  priority: 'CRITICAL' | 'URGENT' | 'ROUTINE',
  mode: string,
  vehicleType: string | null,
) {
  if (priority === 'ROUTINE') return false;
  if (mode === 'PICKUP' || mode === 'EMS_115') return false;
  if (mode === 'FACILITY_VEHICLE')
    return vehicleType !== 'ADVANCED_AMBULANCE' && vehicleType !== 'BASIC_AMBULANCE';
  return true;
}
