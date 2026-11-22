/** Cấu hình phiên đăng nhập dùng chung cho proxy, server actions và server components. */

export type UserRole = 'PATIENT' | 'COMMUNE_STAFF' | 'PROVINCE_STAFF' | 'ADMIN';

export const ACCESS_COOKIE = 'mevita_at';
export const REFRESH_COOKIE = 'mevita_rt';

/** Trang chủ của từng vai trò sau khi đăng nhập */
export const roleHome: Record<UserRole, string> = {
  PATIENT: '/patient',
  COMMUNE_STAFF: '/commune',
  PROVINCE_STAFF: '/province',
  // Chưa có phân hệ quản trị riêng (Task 5.2) — tạm vào trung tâm điều phối
  ADMIN: '/province',
};

/** Vai trò được phép vào từng nhóm đường dẫn. ADMIN được vào mọi phân hệ. */
const protectedPrefixes: { prefix: string; roles: UserRole[] }[] = [
  { prefix: '/patient', roles: ['PATIENT', 'ADMIN'] },
  { prefix: '/commune', roles: ['COMMUNE_STAFF', 'ADMIN'] },
  { prefix: '/escort', roles: ['COMMUNE_STAFF', 'ADMIN'] },
  { prefix: '/province', roles: ['PROVINCE_STAFF', 'ADMIN'] },
];

const matches = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

/** null = trang công khai; ngược lại là danh sách vai trò được phép */
export function allowedRoles(pathname: string): UserRole[] | null {
  return protectedPrefixes.find((p) => matches(pathname, p.prefix))?.roles ?? null;
}

/** Chỉ chấp nhận đường dẫn nội bộ mà vai trò được phép vào (chống open redirect). */
export function safeRedirectPath(next: unknown, role: UserRole): string {
  if (
    typeof next !== 'string' ||
    !next.startsWith('/') ||
    next.startsWith('//') ||
    next.includes('\\')
  ) {
    return roleHome[role];
  }
  const roles = allowedRoles(next);
  return roles && roles.includes(role) ? next : roleHome[role];
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};
