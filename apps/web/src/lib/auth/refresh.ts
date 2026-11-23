import type { TokenPair } from '@/lib/api';

const API_URL = process.env.API_URL ?? 'http://localhost:4000/api';

/** Đổi refresh token lấy cặp token mới (dùng trong proxy và route handler). Null nếu không hợp lệ. */
export async function refreshTokens(refreshToken: string): Promise<TokenPair | null> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
    return res.ok ? ((await res.json()) as TokenPair) : null;
  } catch {
    return null;
  }
}

export const secondsUntil = (iso: string) =>
  Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
