'use server';

import { cookies } from 'next/headers';
import { refresh } from 'next/cache';

import { ApiError, apiFetch } from '@/lib/api';
import { ACCESS_COOKIE } from '@/lib/auth/config';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { profileFormSchema, type ProfileFormValues } from '@/lib/data/profile-schema';

export type UpdateProfileResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Partial<Record<keyof ProfileFormValues, string>> };

export async function updateProfile(values: ProfileFormValues): Promise<UpdateProfileResult> {
  // Server Action là endpoint công khai: luôn tự kiểm tra phiên, không tin dữ liệu từ client
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const session = await verifyAccessToken(token);
  if (!session || session.role !== 'PATIENT')
    return { ok: false, message: 'Phiên đăng nhập đã hết hạn' };

  const parsed = profileFormSchema.safeParse(values);
  if (!parsed.success) return { ok: false, message: 'Vui lòng kiểm tra lại thông tin' };

  // provinceCode chỉ dùng để lọc danh sách xã trên form, API suy ra tỉnh từ mã xã
  const body = Object.fromEntries(
    Object.entries({ ...parsed.data, communeCode: parsed.data.communeCode || null }).filter(
      ([key]) => key !== 'provinceCode',
    ),
  );

  try {
    await apiFetch('/patients/me', { method: 'PATCH', token, body: JSON.stringify(body) });
  } catch (error) {
    if (error instanceof ApiError) {
      const fieldErrors = Object.fromEntries((error.errors ?? []).map((e) => [e.path, e.message]));
      return { ok: false, message: error.message, fieldErrors };
    }
    throw error;
  }
  refresh();
  return { ok: true };
}
