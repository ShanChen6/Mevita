import { jwtVerify } from 'jose';

import type { UserRole } from './config';

export interface SessionClaims {
  userId: string;
  role: UserRole;
  facilityId?: string;
  patientId?: string;
}

const secret = () => {
  const value = process.env.JWT_ACCESS_SECRET;
  if (!value || value.length < 32) throw new Error('Thiếu JWT_ACCESS_SECRET (tối thiểu 32 ký tự)');
  return new TextEncoder().encode(value);
};

/** Kiểm tra access token do API cấp. Trả null nếu thiếu, sai chữ ký hoặc hết hạn. */
export async function verifyAccessToken(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<{ role: UserRole; fid?: string; pid?: string }>(
      token,
      secret(),
      {
        algorithms: ['HS256'],
        issuer: 'mevita-api',
        audience: 'mevita',
      },
    );
    if (!payload.sub || !payload.role) return null;
    return {
      userId: payload.sub,
      role: payload.role,
      facilityId: payload.fid,
      patientId: payload.pid,
    };
  } catch {
    return null;
  }
}
