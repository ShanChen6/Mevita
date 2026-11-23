import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ApiError, apiFetch } from '@/lib/api';
import { ACCESS_COOKIE } from '@/lib/auth/config';
import type { AdminUser, AuditEntry, StatsOverview } from './types';

async function authed<T>(path: string): Promise<T> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) redirect('/login');
  try {
    return await apiFetch<T>(path, { token });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login');
    throw error;
  }
}

const qs = (params: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') p.set(k, String(v));
  return p.toString();
};

export const getStatsProvinces = () => authed<{ code: string; name: string }[]>('/stats/provinces');

export const getStatsOverview = (from: string, to: string, province?: string) =>
  authed<StatsOverview>(`/stats/overview?${qs({ from, to, province })}`);

export const listUsers = (q: { q?: string; role?: string; status?: string; page?: number }) =>
  authed<{ total: number; page: number; pageSize: number; items: AdminUser[] }>(
    `/admin/users?${qs(q)}`,
  );

export const listAudit = (q: {
  action?: string;
  entityType?: string;
  q?: string;
  cursor?: string;
}) => authed<{ items: AuditEntry[]; nextCursor: string | null }>(`/admin/audit-logs?${qs(q)}`);

export const getAuditFacets = () =>
  authed<{ actions: string[]; entityTypes: string[] }>('/admin/audit-logs/facets');
