/** Tên sự kiện Socket.io (server → client) — dùng chung với web. */
export const RealtimeEvent = {
  /** Danh sách nhân viên đang trực của cơ sở thay đổi */
  PresenceUpdate: 'presence_update',
  /** Tín hiệu kiểm tra kênh trực */
  ChannelTest: 'channel_test',
  /** Ca chuyển tuyến mới tới cơ sở (Task 4.2) */
  NewIncomingReferral: 'new_incoming_referral',
  /** Phiếu chuyển tuyến đổi trạng thái: huỷ, tiếp nhận, đã tới… */
  ReferralUpdated: 'referral_updated',
  /** Chỉ số sinh tồn mới trên xe (Task 4.3) */
  VitalUpdate: 'vital_update',
  /** Trạm cần xe đón bệnh nhân — gửi tới bệnh viện nhận và cơ sở lân cận có xe (Task C) */
  PickupRequest: 'pickup_request',
  /** Yêu cầu xe đón đã có cơ sở nhận */
  PickupClosed: 'pickup_closed',
  /** Vị trí xe chuyển viện (client → server có ack; server → các cơ sở liên quan) */
  VehicleLocation: 'vehicle_location',
  /** Xe vào bán kính 1 km quanh bệnh viện nhận */
  VehicleArriving: 'vehicle_arriving',
  /** Bệnh viện chậm phản hồi ca cấp cứu — leo thang (Task B) */
  ReferralEscalated: 'referral_escalated',
  /** Bệnh viện cập nhật năng lực tiếp nhận (gửi điều phối viên) */
  CapacityUpdate: 'capacity_update',
} as const;

export const NAMESPACE = '/realtime';

export const rooms = {
  facility: (facilityId: string) => `facility_${facilityId}`,
  user: (userId: string) => `user_${userId}`,
  admins: 'admins',
};

/** Người dùng gắn với một kết nối socket (lấy từ vé đã xác minh). */
export interface SocketUser {
  id: string;
  role: 'PATIENT' | 'COMMUNE_STAFF' | 'PROVINCE_STAFF' | 'ADMIN';
  facilityId: string | null;
  fullName: string;
  academicTitle: string | null;
}
