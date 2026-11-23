import 'server-only';

import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { ApiError, apiFetch } from '@/lib/api';
import { ACCESS_COOKIE } from '@/lib/auth/config';
import type { Referral, ReferralDestination, StaffOption } from './types';

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

export const getDestinations = () => authed<ReferralDestination[]>('/referrals/destinations');
export const getEscorts = () => authed<StaffOption[]>('/referrals/escorts');

export const listReferrals = (direction: 'incoming' | 'outgoing', active = false) =>
  authed<Referral[]>(`/referrals?direction=${direction}${active ? '&active=true' : ''}`);

export async function getReferral(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return authed<Referral>(`/referrals/${id}`);
}
