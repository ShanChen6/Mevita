import 'server-only';

import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { ApiError, apiFetch } from '@/lib/api';
import { ACCESS_COOKIE } from '@/lib/auth/config';
import type { MedicalRecordItem, Page, PatientProfile } from './types';

/** Hồ sơ & lịch sử khám của một bệnh nhân cho bác sĩ. API kiểm tra quyền; không có quyền → 404. */
export async function getPatientForStaff(patientId: string) {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');
  if (!/^[0-9a-f-]{36}$/i.test(patientId)) notFound();
  try {
    const [profile, records] = await Promise.all([
      apiFetch<PatientProfile>(`/patients/${patientId}`, { token }),
      apiFetch<Page<MedicalRecordItem>>(`/patients/${patientId}/records?limit=10`, { token }),
    ]);
    return { profile, records };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login');
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) notFound();
    throw error;
  }
}
