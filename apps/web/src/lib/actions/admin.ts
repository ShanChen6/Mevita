'use server';

import { cookies } from 'next/headers';
import { refresh } from 'next/cache';
import { z } from 'zod';

import { ApiError, apiFetch } from '@/lib/api';
import { ACCESS_COOKIE } from '@/lib/auth/config';
import type { ActionResult } from './appointments';

/** Khoá / mở khoá tài khoản (quản trị viên). */
export async function setUserActive(id: string, isActive: boolean): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, message: 'Tài khoản không hợp lệ' };
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return { ok: false, message: 'Phiên đăng nhập đã hết hạn' };
  try {
    await apiFetch(`/admin/users/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ isActive }),
    });
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, message: error.message };
    throw error;
  }
  refresh();
  return { ok: true, data: undefined };
}
