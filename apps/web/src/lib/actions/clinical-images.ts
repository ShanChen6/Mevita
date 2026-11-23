'use server';

import { cookies } from 'next/headers';
import { z } from 'zod';

import { ApiError, apiFetch } from '@/lib/api';
import { ACCESS_COOKIE } from '@/lib/auth/config';
import { verifyAccessToken } from '@/lib/auth/jwt';
import type { ClinicalImage } from '@/lib/data/types';
import type { ActionResult } from './appointments';

const IMAGE_TYPES = ['LAB_RESULT', 'XRAY', 'ULTRASOUND', 'CT', 'MRI', 'ECG', 'OTHER'] as const;
export type ClinicalImageTypeValue = (typeof IMAGE_TYPES)[number];

export interface UploadTicket {
  mode: 'cloudinary' | 'mock' | 'disabled';
  uploadUrl: string;
  fields: Record<string, string>;
  publicId: string;
  maxBytes: number;
  allowedFormats: string[];
  expiresAt: string;
}

async function call<T>(path: string, init: RequestInit): Promise<ActionResult<T>> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const claims = await verifyAccessToken(token);
  if (!token || !claims || (claims.role !== 'COMMUNE_STAFF' && claims.role !== 'PROVINCE_STAFF')) {
    return { ok: false, message: 'Phiên đăng nhập đã hết hạn hoặc không có quyền' };
  }
  try {
    return { ok: true, data: await apiFetch<T>(path, { ...init, token }) };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, message: error.message };
    throw error;
  }
}

const uuid = z.uuid();

/** Xin vé upload có chữ ký — trình duyệt dùng vé này tải ảnh thẳng lên Cloudinary. */
export async function requestUploadTicket(recordId: string, type: ClinicalImageTypeValue) {
  if (!uuid.safeParse(recordId).success || !IMAGE_TYPES.includes(type))
    return { ok: false as const, message: 'Yêu cầu không hợp lệ' };
  return call<UploadTicket>(`/medical-records/${recordId}/images/upload-ticket`, {
    method: 'POST',
    body: JSON.stringify({ type }),
  });
}

/** Xác nhận ảnh đã tải lên để API kiểm tra và gắn vào hồ sơ. */
export async function confirmUpload(
  recordId: string,
  input: { publicId: string; type: ClinicalImageTypeValue; description: string },
) {
  if (
    !uuid.safeParse(recordId).success ||
    !IMAGE_TYPES.includes(input.type) ||
    input.description.length > 500
  ) {
    return { ok: false as const, message: 'Yêu cầu không hợp lệ' };
  }
  return call<ClinicalImage>(`/medical-records/${recordId}/images`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteImage(recordId: string, imageId: string) {
  if (!uuid.safeParse(recordId).success || !uuid.safeParse(imageId).success)
    return { ok: false as const, message: 'Yêu cầu không hợp lệ' };
  return call<undefined>(`/medical-records/${recordId}/images/${imageId}`, { method: 'DELETE' });
}
