'use server';

import { cookies } from 'next/headers';

import { ApiError, apiFetch } from '@/lib/api';
import { ACCESS_COOKIE } from '@/lib/auth/config';
import type { ActionResult } from './appointments';

export async function sendTestSignal(): Promise<
  ActionResult<{ delivered: number; sentAt: string }>
> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return { ok: false, message: 'Phiên đăng nhập đã hết hạn' };
  try {
    return { ok: true, data: await apiFetch('/realtime/test-signal', { method: 'POST', token }) };
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        ok: false,
        message: error.status === 429 ? 'Gửi quá nhiều lần, vui lòng đợi một chút' : error.message,
      };
    }
    throw error;
  }
}
