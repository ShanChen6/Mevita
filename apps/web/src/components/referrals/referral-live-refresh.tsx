'use client';

import { useRouter } from 'next/navigation';

import { useRealtimeEvent } from '@/components/realtime/realtime-provider';

/** Tải lại dữ liệu trang (server components) khi có ca chuyển tuyến mới hoặc ca thay đổi trạng thái. */
export function ReferralLiveRefresh({ vitals = false }: { vitals?: boolean }) {
  const router = useRouter();
  useRealtimeEvent('new_incoming_referral', () => router.refresh());
  useRealtimeEvent('referral_updated', () => router.refresh());
  // Bảng điều phối: thẻ ca hiện chỉ số mới nhất trên xe
  useRealtimeEvent('vital_update', () => {
    if (vitals) router.refresh();
  });
  return null;
}
