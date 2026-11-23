'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useRealtimeEvent } from '@/components/realtime/realtime-provider';

/** Trang điều phối tự làm mới: khi có leo thang / bệnh viện cập nhật năng lực, và mỗi 60 giây. */
export function CoordinationLive() {
  const router = useRouter();
  useRealtimeEvent('referral_escalated', () => router.refresh());
  useRealtimeEvent('capacity_update', () => router.refresh());
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
