'use client';

import { useState } from 'react';

import { useRealtimeEvent } from '@/components/realtime/realtime-provider';
import type { VitalLog, VitalUpdateEvent } from '@/lib/data/types';

/** Danh sách sinh tồn ban đầu (từ máy chủ) + bản mới nhận qua `vital_update`, gộp theo clientId, cũ → mới. */
export function useLiveVitals(referralId: string, initial: VitalLog[]) {
  const [live, setLive] = useState<VitalLog[]>([]);
  useRealtimeEvent<VitalUpdateEvent>('vital_update', (e) => {
    if (e.referralId === referralId) setLive((prev) => [...prev, ...e.vitals]);
  });
  const byId = new Map<string, VitalLog>();
  for (const v of [...initial, ...live]) byId.set(v.clientId, v);
  return [...byId.values()].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
}
