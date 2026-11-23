'use server';

import { cookies } from 'next/headers';
import { refresh } from 'next/cache';
import { z } from 'zod';

import { ApiError, apiFetch } from '@/lib/api';
import { ACCESS_COOKIE } from '@/lib/auth/config';
import type { ActionResult } from './appointments';

async function send(path: string, method: 'POST' | 'PATCH', body: unknown): Promise<ActionResult> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return { ok: false, message: 'Phiên đăng nhập đã hết hạn' };
  try {
    await apiFetch(path, { method, token, body: JSON.stringify(body) });
  } catch (error) {
    if (error instanceof ApiError) {
      const detail = error.errors?.map((e) => e.message).join('; ');
      return { ok: false, message: detail ? `${error.message}: ${detail}` : error.message };
    }
    throw error;
  }
  refresh();
  return { ok: true, data: undefined };
}

export interface VehicleFormValues {
  plateNumber: string;
  type: 'ADVANCED_AMBULANCE' | 'BASIC_AMBULANCE' | 'TRANSPORT';
  equipment: string;
  driverName: string;
  driverPhone: string;
}

export async function createVehicle(values: VehicleFormValues) {
  return send('/vehicles', 'POST', values);
}

export async function setVehicleStatus(id: string, status: 'AVAILABLE' | 'MAINTENANCE') {
  if (!z.uuid().safeParse(id).success) return { ok: false as const, message: 'Xe không hợp lệ' };
  return send(`/vehicles/${id}`, 'PATCH', { status });
}
