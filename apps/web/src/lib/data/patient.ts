import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ApiError, apiFetch } from '@/lib/api';
import { ACCESS_COOKIE } from '@/lib/auth/config';
import type {
  CommuneOption,
  MedicalRecordItem,
  Page,
  PatientProfile,
  ProvinceOption,
} from './types';

/**
 * Lớp truy cập dữ liệu (DAL) của cổng bệnh nhân. Luôn đọc token từ cookie phía server;
 * quyền truy cập do API kiểm tra. Phiên hết hạn → về trang đăng nhập.
 */
async function withToken<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');
  try {
    return await fn(token);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login');
    throw error;
  }
}

export const getMyProfile = () =>
  withToken((token) => apiFetch<PatientProfile>('/patients/me', { token }));

export const getMyRecords = (cursor?: string, limit = 10) =>
  withToken((token) => {
    const qs = new URLSearchParams({ limit: String(limit), ...(cursor && { cursor }) });
    return apiFetch<Page<MedicalRecordItem>>(`/patients/me/records?${qs}`, { token });
  });

/** Danh mục công khai — không cần đăng nhập. */
export const getProvinces = () => apiFetch<ProvinceOption[]>('/provinces');

export const getCommunes = (provinceCode: string) =>
  apiFetch<CommuneOption[]>(`/provinces/${encodeURIComponent(provinceCode)}/communes`);
