import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { API_URL } from '@/lib/api';
import { ACCESS_COOKIE, cookieOptions, REFRESH_COOKIE } from '@/lib/auth/config';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { refreshTokens, secondsUntil } from '@/lib/auth/refresh';

/**
 * Đổi phiên đăng nhập (cookie httpOnly) lấy vé Socket.io ngắn hạn cho trình duyệt.
 * Access token hết hạn thì tự làm mới phiên trước — kết nối realtime chạy lâu hơn 15 phút.
 */
export async function POST() {
  const store = await cookies();
  let token = store.get(ACCESS_COOKIE)?.value;

  if (!(await verifyAccessToken(token))) {
    const refreshToken = store.get(REFRESH_COOKIE)?.value;
    const tokens = refreshToken ? await refreshTokens(refreshToken) : null;
    if (!tokens)
      return NextResponse.json({ message: 'Phiên đăng nhập đã hết hạn' }, { status: 401 });
    store.set(ACCESS_COOKIE, tokens.accessToken, {
      ...cookieOptions,
      maxAge: secondsUntil(tokens.accessTokenExpiresAt),
    });
    store.set(REFRESH_COOKIE, tokens.refreshToken, {
      ...cookieOptions,
      maxAge: secondsUntil(tokens.refreshTokenExpiresAt),
    });
    token = tokens.accessToken;
  }

  try {
    const res = await fetch(`${API_URL}/realtime/ticket`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const body: unknown = await res.json();
    return NextResponse.json(body, {
      status: res.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ message: 'Không kết nối được máy chủ' }, { status: 503 });
  }
}
