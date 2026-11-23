import { NextResponse, type NextRequest } from 'next/server';

import {
  ACCESS_COOKIE,
  allowedRoles,
  cookieOptions,
  REFRESH_COOKIE,
  roleHome,
} from '@/lib/auth/config';
import { verifyAccessToken, type SessionClaims } from '@/lib/auth/jwt';
import { refreshTokens, secondsUntil } from '@/lib/auth/refresh';
import type { TokenPair } from '@/lib/api';

const AUTH_PAGES = ['/login', '/register'];

/**
 * Kiểm tra lạc quan (optimistic) trước khi render:
 * - Access token hết hạn → dùng refresh token lấy cặp mới (xoay vòng), ghi lại cookie.
 * - Chưa đăng nhập mà vào phân hệ → về /login?next=...
 * - Sai vai trò → về trang chủ của vai trò.
 * Quyền truy cập dữ liệu thật vẫn do API kiểm tra ở từng request.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const roles = allowedRoles(pathname);
  const isAuthPage = AUTH_PAGES.includes(pathname);

  let session: SessionClaims | null = await verifyAccessToken(
    request.cookies.get(ACCESS_COOKIE)?.value,
  );
  let tokens: TokenPair | null = null;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (!session && refreshToken) {
    tokens = await refreshTokens(refreshToken);
    session = tokens ? await verifyAccessToken(tokens.accessToken) : null;
  }

  let response: NextResponse;
  if (!session && roles) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', pathname + search);
    response = NextResponse.redirect(login);
  } else if (session && isAuthPage) {
    response = NextResponse.redirect(new URL(roleHome[session.role], request.url));
  } else if (session && roles && !roles.includes(session.role)) {
    response = NextResponse.redirect(new URL(roleHome[session.role], request.url));
  } else if (tokens) {
    // Chuyển token mới cho server components trong chính request này
    request.cookies.set(ACCESS_COOKIE, tokens.accessToken);
    request.cookies.set(REFRESH_COOKIE, tokens.refreshToken);
    response = NextResponse.next({ request: { headers: request.headers } });
  } else {
    response = NextResponse.next();
  }

  if (tokens) {
    response.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
      ...cookieOptions,
      maxAge: secondsUntil(tokens.accessTokenExpiresAt),
    });
    response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
      ...cookieOptions,
      maxAge: secondsUntil(tokens.refreshTokenExpiresAt),
    });
  } else if (!session && refreshToken) {
    // Refresh token không còn hợp lệ → xoá phiên cũ
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
  }
  return response;
}

export const config = {
  matcher: [
    '/patient/:path*',
    '/commune/:path*',
    '/escort/:path*',
    '/province/:path*',
    '/login',
    '/register',
  ],
};
