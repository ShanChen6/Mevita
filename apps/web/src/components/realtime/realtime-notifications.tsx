'use client';

import { useRouter } from 'next/navigation';
import { toast, Toaster } from 'sonner';

import type { IncomingReferralAlert } from '@/lib/data/types';
import { formatTime } from '@/lib/format';
import { referralPriority } from '@/lib/labels';
import { useRealtimeEvent } from './realtime-provider';

interface ChannelTest {
  from: { id: string; fullName: string; academicTitle: string | null };
  sentAt: string;
}

/** Thông báo (toast) cho các sự kiện realtime chung của phân hệ nhân viên y tế. */
export function RealtimeNotifications() {
  const router = useRouter();
  useRealtimeEvent<IncomingReferralAlert>('new_incoming_referral', (r) => {
    const dx = r.diagnosis ? `${r.diagnosis.icdCode} ${r.diagnosis.name}` : r.reason;
    toast.error(`${referralPriority[r.priority].label}: ca chuyển tuyến mới ${r.code}`, {
      id: `referral-${r.id}`,
      duration: r.priority === 'CRITICAL' ? Infinity : 30_000,
      description: `${r.patient.fullName} — ${dx}. Từ ${r.fromFacility.name}${
        r.estimatedArrivalAt ? `, dự kiến tới ${formatTime(r.estimatedArrivalAt)}` : ''
      }.${r.patient.allergies ? ` Dị ứng: ${r.patient.allergies}.` : ''}`,
      action: { label: 'Xem', onClick: () => router.push(`/province/referrals/${r.id}`) },
    });
  });
  useRealtimeEvent<{ id: string; code: string; status: string; cancellationReason?: string }>(
    'referral_updated',
    (r) => {
      if (r.status !== 'CANCELLED') return;
      toast.dismiss(`referral-${r.id}`);
      toast.warning(`Tuyến dưới đã huỷ lệnh ${r.code}`, { description: r.cancellationReason });
    },
  );
  useRealtimeEvent<ChannelTest>('channel_test', (e) => {
    const who = e.from.academicTitle
      ? `${e.from.academicTitle}. ${e.from.fullName}`
      : e.from.fullName;
    toast.info('Tín hiệu kiểm tra kênh trực', {
      description: `Từ ${who} lúc ${formatTime(e.sentAt)} — kết nối thông suốt.`,
    });
  });
  return (
    <Toaster position="top-right" richColors closeButton offset={72} mobileOffset={{ top: 64 }} />
  );
}
