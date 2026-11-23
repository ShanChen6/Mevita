/** Tên sự kiện Socket.io (server → client) — dùng chung với web. */
export const RealtimeEvent = {
  /** Danh sách nhân viên đang trực của cơ sở thay đổi */
  PresenceUpdate: 'presence_update',
  /** Tín hiệu kiểm tra kênh trực */
  ChannelTest: 'channel_test',
  /** Ca chuyển tuyến mới tới cơ sở (Task 4.2) */
  NewIncomingReferral: 'new_incoming_referral',
  /** Chỉ số sinh tồn mới trên xe (Task 4.3) */
  VitalUpdate: 'vital_update',
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
