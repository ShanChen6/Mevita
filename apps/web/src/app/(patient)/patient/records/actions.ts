'use server';

import { ApiError } from '@/lib/api';
import { getMyRecords } from '@/lib/data/patient';
import type { MedicalRecordItem, Page } from '@/lib/data/types';

export async function loadMoreRecords(
  cursor: string,
): Promise<Page<MedicalRecordItem> | { error: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(cursor)) return { error: 'Yêu cầu không hợp lệ' };
  try {
    return await getMyRecords(cursor);
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
}
