import 'server-only';

import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { ApiError, apiFetch } from '@/lib/api';
import { ACCESS_COOKIE } from '@/lib/auth/config';
import type { EncounterQueueItem, FacilityDetail, MedicalRecordDetail } from './types';

async function authed<T>(path: string): Promise<T> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');
  try {
    return await apiFetch<T>(path, { token });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login');
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
}

export const getOpenEncounters = () => authed<EncounterQueueItem[]>('/medical-records/open');

export async function getRecord(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return authed<MedicalRecordDetail>(`/medical-records/${id}`);
}

export const verifyRecord = (id: string) =>
  authed<{ signed: boolean; valid: boolean; signedAt?: string }>(`/medical-records/${id}/verify`);

/** Chuyên khoa của cơ sở (danh mục công khai) */
export const getFacilitySpecialties = async (facilityId: string) =>
  (await apiFetch<FacilityDetail>(`/facilities/${facilityId}`)).specialties;
