'use server';

import { cookies } from 'next/headers';
import { refresh } from 'next/cache';
import { z } from 'zod';

import { ApiError, apiFetch } from '@/lib/api';
import { ACCESS_COOKIE } from '@/lib/auth/config';
import { verifyAccessToken } from '@/lib/auth/jwt';
import type { Appointment, StaffAppointment } from '@/lib/data/types';

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; message: string };

async function session() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const claims = await verifyAccessToken(token);
  return claims && token ? { token, claims } : null;
}

async function call<T>(path: string, body?: unknown): Promise<ActionResult<T>> {
  const s = await session();
  if (!s) return { ok: false, message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại' };
  try {
    const data = await apiFetch<T>(path, {
      method: 'POST',
      token: s.token,
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
    return { ok: true, data };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, message: error.message };
    throw error;
  }
}

const createSchema = z.object({
  facilityId: z.uuid(),
  specialtyId: z.uuid(),
  doctorId: z.uuid().nullable(),
  startAt: z.iso.datetime(),
  reason: z.string().trim().min(3, 'Nhập lý do khám').max(500),
  initialSymptoms: z.string().trim().max(2000),
});

/** Bệnh nhân đặt lịch (bước 3). */
export async function createAppointment(
  input: z.input<typeof createSchema>,
): Promise<ActionResult<Appointment>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' };
  return call<Appointment>('/appointments', parsed.data);
}

const id = z.uuid();
const reason = z.string().trim().min(3, 'Nhập lý do huỷ (tối thiểu 3 ký tự)').max(500);

/** Huỷ lịch — bệnh nhân hoặc cơ sở y tế. */
export async function cancelAppointment(
  appointmentId: string,
  cancelReason: string,
): Promise<ActionResult<Appointment>> {
  const r = reason.safeParse(cancelReason);
  if (!id.safeParse(appointmentId).success || !r.success) {
    return { ok: false, message: r.error?.issues[0]?.message ?? 'Yêu cầu không hợp lệ' };
  }
  const res = await call<Appointment>(`/appointments/${appointmentId}/cancel`, { reason: r.data });
  if (res.ok) refresh();
  return res;
}

/** Thao tác của cơ sở y tế: duyệt, tiếp đón (tạo phiếu khám), đánh dấu không đến. */
export async function staffAppointmentAction(
  appointmentId: string,
  action: 'confirm' | 'check-in' | 'no-show',
): Promise<ActionResult<StaffAppointment>> {
  if (
    !id.safeParse(appointmentId).success ||
    !['confirm', 'check-in', 'no-show'].includes(action)
  ) {
    return { ok: false, message: 'Yêu cầu không hợp lệ' };
  }
  const res = await call<StaffAppointment>(`/appointments/${appointmentId}/${action}`);
  if (res.ok) refresh();
  return res;
}
