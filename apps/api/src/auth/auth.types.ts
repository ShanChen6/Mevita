import type { UserRole } from '../generated/prisma/enums.js';

/** Người dùng đã xác thực — gắn vào request sau khi kiểm tra access token. */
export interface AuthUser {
  id: string;
  role: UserRole;
  /** Cơ sở công tác (nhân viên y tế) */
  facilityId: string | null;
  /** Hồ sơ bệnh nhân gắn với tài khoản (vai trò PATIENT) */
  patientId: string | null;
}

/** Nội dung access token (JWT). Giữ ngắn gọn, không chứa thông tin nhạy cảm. */
export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  fid?: string;
  pid?: string;
}

export interface TokenPair {
  accessToken: string;
  /** Thời điểm access token hết hạn (ISO) */
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}
