import 'server-only';

import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { ApiError, apiFetch } from '@/lib/api';
import { ACCESS_COOKIE } from '@/lib/auth/config';
import type {
  PickupRequest,
  Referral,
  ReferralDestination,
  StaffOption,
  TrackPoint,
  TransportOptions,
  Vehicle,
  VitalLog,
} from './types';

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

export const listReferrals = (
  direction: 'incoming' | 'outgoing',
  active = false,
  status?: Referral['status'],
) =>
  authed<Referral[]>(
    `/referrals?direction=${direction}${active ? '&active=true' : ''}${status ? `&status=${status}` : ''}`,
  );

export async function getReferral(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return authed<Referral>(`/referrals/${id}`);
}

export async function getReferralVitals(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return authed<VitalLog[]>(`/referrals/${id}/vitals`);
}

/** Như getReferral nhưng trả null khi không có quyền xem (dùng làm phần phụ của trang khác). */
export async function findReferral(id: string): Promise<Referral | null> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  try {
    return await apiFetch<Referral>(`/referrals/${id}`, { token });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) return null;
    throw error;
  }
}

export async function findReferralVitals(id: string): Promise<VitalLog[]> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return [];
  try {
    return await apiFetch<VitalLog[]>(`/referrals/${id}/vitals`, { token });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) return [];
    throw error;
  }
}

export const getTransportOptions = () => authed<TransportOptions>('/referrals/transport-options');
export const getVehicles = () => authed<Vehicle[]>('/vehicles');
export const getPickupRequests = () => authed<PickupRequest[]>('/referrals/pickup-requests');

export async function findReferralTrack(id: string): Promise<TrackPoint[]> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return [];
  try {
    return await apiFetch<TrackPoint[]>(`/referrals/${id}/locations`, { token });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) return [];
    throw error;
  }
}
