'use server';

import { cookies } from 'next/headers';
import { z } from 'zod';

import { ApiError, apiFetch } from '@/lib/api';
import { ACCESS_COOKIE } from '@/lib/auth/config';
import { verifyAccessToken } from '@/lib/auth/jwt';
import type { LookupKind, MedicalRecordItem, Page, PatientLookupResult } from '@/lib/data/types';
import type { ActionResult } from './appointments';

async function staffToken() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const claims = await verifyAccessToken(token);
  if (!token || !claims || (claims.role !== 'COMMUNE_STAFF' && claims.role !== 'PROVINCE_STAFF'))
    return null;
  return token;
}

async function run<T>(fn: (token: string) => Promise<T>): Promise<ActionResult<T>> {
  const token = await staffToken();
  if (!token) return { ok: false, message: 'Phiên đăng nhập đã hết hạn hoặc không có quyền' };
  try {
    return { ok: true, data: await fn(token) };
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        ok: false,
        message:
          error.status === 429 ? 'Tra cứu quá nhiều lần, vui lòng đợi giây lát' : error.message,
      };
    }
    throw error;
  }
}

/** Tra cứu nhanh bệnh nhân (CCCD, BHYT, SĐT, mã lịch hẹn hoặc tên). */
export async function lookupPatients(q: string) {
  const query = q.trim();
  if (query.length < 2 || query.length > 100)
    return { ok: false as const, message: 'Nhập ít nhất 2 ký tự' };
  return run((token) =>
    apiFetch<{ kind: LookupKind; patients: PatientLookupResult[] }>(
      `/patients/lookup?${new URLSearchParams({ q: query })}`,
      { token },
    ),
  );
}

const createSchema = z.object({
  fullName: z.string().trim().min(2, 'Nhập họ và tên').max(150),
  dateOfBirth: z.iso.date('Chọn ngày sinh'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  nationalId: z.union([z.literal(''), z.string().regex(/^\d{12}$/, 'Số CCCD gồm đúng 12 chữ số')]),
  healthInsuranceNumber: z.string().trim().max(18),
  phone: z.string().trim().max(15),
  allergies: z.string().trim().max(2000),
});
export type CreatePatientValues = z.input<typeof createSchema>;

/** Quầy tiếp đón tạo hồ sơ bệnh nhân vãng lai. */
export async function createWalkInPatient(values: CreatePatientValues) {
  const parsed = createSchema.safeParse(values);
  if (!parsed.success)
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ',
    };
  const body = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== ''));
  return run((token) =>
    apiFetch<{ id: string; fullName: string }>('/patients', {
      method: 'POST',
      token,
      body: JSON.stringify(body),
    }),
  );
}

const encounterSchema = z.object({
  patientId: z.uuid(),
  chiefComplaint: z.string().trim().min(2, 'Nhập lý do đến khám').max(500),
  encounterType: z.enum(['OUTPATIENT', 'EMERGENCY']),
});

/** Bắt đầu khám cho bệnh nhân đến trực tiếp — mở phiếu khám nháp. */
export async function startEncounter(values: z.input<typeof encounterSchema>) {
  const parsed = encounterSchema.safeParse(values);
  if (!parsed.success)
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ',
    };
  return run((token) =>
    apiFetch<{ id: string; code: string; created: boolean }>('/encounters', {
      method: 'POST',
      token,
      body: JSON.stringify(parsed.data),
    }),
  );
}

/** Trang tiếp theo của lịch sử khám một bệnh nhân (bác sĩ xem). */
export async function loadPatientRecords(
  patientId: string,
  cursor: string,
): Promise<Page<MedicalRecordItem> | { error: string }> {
  if (!z.uuid().safeParse(patientId).success || !z.uuid().safeParse(cursor).success) {
    return { error: 'Yêu cầu không hợp lệ' };
  }
  const res = await run((token) =>
    apiFetch<Page<MedicalRecordItem>>(`/patients/${patientId}/records?limit=10&cursor=${cursor}`, {
      token,
    }),
  );
  return res.ok ? res.data : { error: res.message };
}
