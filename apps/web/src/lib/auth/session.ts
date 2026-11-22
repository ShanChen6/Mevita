import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { apiFetch, type TokenPair } from '@/lib/api';
import { ACCESS_COOKIE, cookieOptions, REFRESH_COOKIE, type UserRole } from './config';
import { verifyAccessToken } from './jwt';

export interface CurrentUser {
  id: string;
  fullName: string;
  role: UserRole;
  /** Dòng phụ hiển thị: cơ sở công tác hoặc "Bệnh nhân" */
  subtitle: string;
  displayName: string;
}

interface MeResponse {
  id: string;
  fullName: string;
  role: UserRole;
  staffProfile: { academicTitle: string | null; facility: { name: string } } | null;
}

/** Ghi cặp token vào cookie httpOnly (dùng trong Server Action / Route Handler). */
export async function setSessionCookies(tokens: TokenPair) {
  const store = await cookies();
  const maxAge = (iso: string) =>
    Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
  store.set(ACCESS_COOKIE, tokens.accessToken, {
    ...cookieOptions,
    maxAge: maxAge(tokens.accessTokenExpiresAt),
  });
  store.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...cookieOptions,
    maxAge: maxAge(tokens.refreshTokenExpiresAt),
  });
}

export async function clearSessionCookies() {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

/** Đọc phiên hiện tại từ cookie (đã được proxy làm mới nếu cần). */
export async function getSession() {
  return verifyAccessToken((await cookies()).get(ACCESS_COOKIE)?.value);
}

/** Người dùng đang đăng nhập (gọi /auth/me). Chuyển về /login nếu chưa đăng nhập. */
export async function getCurrentUser(): Promise<CurrentUser> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const session = await verifyAccessToken(token);
  if (!session) redirect('/login');

  const me = await apiFetch<MeResponse>('/auth/me', { token });
  const title = me.staffProfile?.academicTitle;
  return {
    id: me.id,
    fullName: me.fullName,
    role: me.role,
    displayName: title ? `${title}. ${me.fullName}` : me.fullName,
    subtitle:
      me.staffProfile?.facility.name ?? (me.role === 'ADMIN' ? 'Quản trị hệ thống' : 'Bệnh nhân'),
  };
}
