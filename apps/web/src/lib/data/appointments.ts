import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ApiError, apiFetch } from '@/lib/api';
import { ACCESS_COOKIE } from '@/lib/auth/config';
import type { Appointment, AppointmentStatusValue, StaffAppointment } from './types';

async function token() {
  const value = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!value) redirect('/login');
  return value;
}

async function authed<T>(path: string): Promise<T> {
  try {
    return await apiFetch<T>(path, { token: await token() });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login');
    throw error;
  }
}

export const getMyAppointments = (scope: 'upcoming' | 'past' = 'upcoming') =>
  authed<Appointment[]>(`/appointments/me?scope=${scope}`);

export const getFacilityAppointments = (date: string, status?: AppointmentStatusValue) =>
  authed<StaffAppointment[]>(
    `/appointments/facility?${new URLSearchParams({ date, ...(status && { status }) })}`,
  );
