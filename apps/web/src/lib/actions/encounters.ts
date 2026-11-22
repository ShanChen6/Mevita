'use server';

import { cookies } from 'next/headers';
import { refresh } from 'next/cache';
import { z } from 'zod';

import { ApiError, apiFetch } from '@/lib/api';
import { ACCESS_COOKIE } from '@/lib/auth/config';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { recordFormSchema, type RecordFormValues } from '@/lib/data/record-schema';
import type { Icd10Option, MedicalRecordDetail } from '@/lib/data/types';
import type { ActionResult } from './appointments';

async function staffToken() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const claims = await verifyAccessToken(token);
  return token && claims && (claims.role === 'COMMUNE_STAFF' || claims.role === 'PROVINCE_STAFF')
    ? token
    : null;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<ActionResult<T>> {
  const token = await staffToken();
  if (!token) return { ok: false, message: 'Phiên đăng nhập đã hết hạn hoặc không có quyền' };
  try {
    return { ok: true, data: await apiFetch<T>(path, { ...init, token }) };
  } catch (error) {
    if (error instanceof ApiError) {
      const detail = error.errors?.map((e) => e.message).join('; ');
      return { ok: false, message: detail ? `${error.message}: ${detail}` : error.message };
    }
    throw error;
  }
}

const id = z.uuid();

/** Tra cứu nhanh ICD-10 cho ô chẩn đoán. */
export async function searchIcd10(q: string): Promise<Icd10Option[]> {
  const query = q.trim();
  if (!query || query.length > 100) return [];
  const res = await call<Icd10Option[]>(`/icd10?${new URLSearchParams({ q: query, limit: '12' })}`);
  return res.ok ? res.data : [];
}

/** Lưu nháp phiếu khám. */
export async function saveRecord(
  recordId: string,
  values: RecordFormValues,
): Promise<ActionResult<MedicalRecordDetail>> {
  if (!id.safeParse(recordId).success) return { ok: false, message: 'Yêu cầu không hợp lệ' };
  const parsed = recordFormSchema.safeParse(values);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' };
  const v = parsed.data;
  const body = {
    ...v,
    specialtyId: v.specialtyId || null,
    diagnoses: v.diagnoses.map(({ icdCode, isPrimary }) => ({ icdCode, isPrimary })),
    prescriptionItems: v.prescriptionItems.map((p) => ({ ...p, strength: p.strength || null })),
  };
  return call<MedicalRecordDetail>(`/medical-records/${recordId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/** Ký xác nhận hoàn tất khám (nhập lại mật khẩu). */
export async function signRecord(
  recordId: string,
  password: string,
): Promise<ActionResult<MedicalRecordDetail>> {
  if (!id.safeParse(recordId).success || !password || password.length > 128) {
    return { ok: false, message: 'Yêu cầu không hợp lệ' };
  }
  const res = await call<MedicalRecordDetail>(`/medical-records/${recordId}/sign`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  if (res.ok) refresh();
  return res;
}
