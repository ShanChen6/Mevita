'use server';

import { cookies } from 'next/headers';
import { refresh } from 'next/cache';
import { z } from 'zod';

import { ApiError, apiFetch } from '@/lib/api';
import { ACCESS_COOKIE } from '@/lib/auth/config';
import { referralFormSchema, type ReferralFormValues } from '@/lib/data/referral-schema';
import type { Referral } from '@/lib/data/types';
import type { ActionResult } from './appointments';

async function call<T>(
  path: string,
  body: unknown,
  method: 'POST' | 'PATCH' = 'POST',
): Promise<ActionResult<T>> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return { ok: false, message: 'Phiên đăng nhập đã hết hạn' };
  try {
    return {
      ok: true,
      data: await apiFetch<T>(path, { method, token, body: JSON.stringify(body) }),
    };
  } catch (error) {
    if (error instanceof ApiError) {
      const detail = error.errors?.map((e) => e.message).join('; ');
      return { ok: false, message: detail ? `${error.message}: ${detail}` : error.message };
    }
    throw error;
  }
}

/** Gửi lệnh chuyển tuyến khẩn cấp. `delivered` = số kết nối bác sĩ trực đã nhận cảnh báo. */
export async function createReferral(values: ReferralFormValues) {
  const parsed = referralFormSchema.safeParse(values);
  if (!parsed.success)
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ',
    };
  const v = parsed.data;
  return call<{
    referral: Referral;
    delivered: number;
    pickup?: { delivered: number; facilities: number };
  }>('/referrals', {
    ...v,
    escortId: v.escortId || null,
    initialTreatment: v.initialTreatment || null,
    vehicleInfo: v.vehicleInfo || null,
    vehicleId: v.transportMode === 'FACILITY_VEHICLE' ? v.vehicleId || null : null,
    transportNote: v.transportNote || null,
    etaMinutes: v.transportMode === 'PICKUP' || Number.isNaN(v.etaMinutes) ? null : v.etaMinutes,
  });
}

export async function cancelReferral(id: string, reason: string): Promise<ActionResult<Referral>> {
  if (!z.uuid().safeParse(id).success || reason.trim().length < 3)
    return { ok: false, message: 'Nhập lý do huỷ' };
  const res = await call<Referral>(`/referrals/${id}/cancel`, { reason });
  if (res.ok) refresh();
  return res;
}

const validId = (id: string) => z.uuid().safeParse(id).success;

/** Tuyến trên: xác nhận tiếp nhận & sẵn sàng ê-kíp. */
export async function acceptReferral(
  id: string,
  preparationNote: string,
): Promise<ActionResult<Referral>> {
  if (!validId(id)) return { ok: false, message: 'Phiếu không hợp lệ' };
  const res = await call<Referral>(`/referrals/${id}/accept`, {
    preparationNote: preparationNote.trim() || null,
  });
  if (res.ok) refresh();
  return res;
}

export async function updatePreparation(
  id: string,
  preparationNote: string,
): Promise<ActionResult<Referral>> {
  if (!validId(id) || preparationNote.trim().length < 3)
    return { ok: false, message: 'Nhập ghi chú chuẩn bị' };
  const res = await call<Referral>(`/referrals/${id}/preparation`, { preparationNote }, 'PATCH');
  if (res.ok) refresh();
  return res;
}

export async function rejectReferral(id: string, reason: string): Promise<ActionResult<Referral>> {
  if (!validId(id) || reason.trim().length < 5)
    return { ok: false, message: 'Nhập lý do (ít nhất 5 ký tự)' };
  const res = await call<Referral>(`/referrals/${id}/reject`, { reason });
  if (res.ok) refresh();
  return res;
}

/** Xe đã tới: tiếp nhận bệnh nhân và mở hồ sơ điều trị tiếp nối (trả id hồ sơ để chuyển trang). */
export async function arriveReferral(
  id: string,
): Promise<ActionResult<{ recordId: string; created: boolean }>> {
  if (!validId(id)) return { ok: false, message: 'Phiếu không hợp lệ' };
  const res = await call<{ recordId: string; created: boolean }>(`/referrals/${id}/arrive`, {});
  if (res.ok) refresh();
  return res;
}

/** Cơ sở cử xe đón bệnh nhân (cơ sở đầu tiên được giao ca). */
export async function dispatchVehicle(
  id: string,
  vehicleId: string,
): Promise<ActionResult<{ pickupMinutes: number | null }>> {
  if (!validId(id) || !validId(vehicleId)) return { ok: false, message: 'Dữ liệu không hợp lệ' };
  const res = await call<{ pickupMinutes: number | null }>(`/referrals/${id}/dispatch`, {
    vehicleId,
  });
  if (res.ok) refresh();
  return res;
}

export async function markPickedUp(id: string): Promise<ActionResult<Referral>> {
  if (!validId(id)) return { ok: false, message: 'Phiếu không hợp lệ' };
  const res = await call<Referral>(`/referrals/${id}/picked-up`, {});
  if (res.ok) refresh();
  return res;
}
