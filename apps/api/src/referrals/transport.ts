import type { ReferralPriority, TransportMode, VehicleType } from '../generated/prisma/enums.js';

/**
 * Khuyến nghị phương tiện theo tình trạng bệnh nhân (Task C):
 * - Tối khẩn: bắt buộc xe cứu thương (của cơ sở, xe đón hoặc 115) — không để gia đình tự chở.
 * - Khẩn: ưu tiên xe cứu thương; xe thường / gia đình chỉ khi có lý do.
 * - Thường: phương tiện nào cũng được.
 * Chọn thấp hơn khuyến nghị phải ghi lý do (lưu `transportNote`, ghi nhật ký).
 */
export const AMBULANCES: VehicleType[] = ['ADVANCED_AMBULANCE', 'BASIC_AMBULANCE'];

export function belowRecommendation(
  priority: ReferralPriority,
  mode: TransportMode,
  vehicleType: VehicleType | null,
): boolean {
  if (priority === 'ROUTINE') return false;
  if (mode === 'PICKUP' || mode === 'EMS_115') return false;
  if (mode === 'FACILITY_VEHICLE') return vehicleType === null || !AMBULANCES.includes(vehicleType);
  return true; // FAMILY, OTHER
}

export function recommendation(priority: ReferralPriority): string {
  if (priority === 'CRITICAL')
    return 'Tối khẩn: dùng xe cứu thương (ưu tiên xe hồi sức). Trạm không có xe thì yêu cầu xe đón hoặc gọi 115.';
  if (priority === 'URGENT')
    return 'Khẩn: ưu tiên xe cứu thương. Xe thường hoặc gia đình tự túc phải ghi lý do.';
  return 'Thường: phương tiện nào cũng được, có thể gia đình tự túc.';
}
