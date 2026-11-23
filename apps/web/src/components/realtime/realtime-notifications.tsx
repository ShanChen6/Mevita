'use client';

import { toast, Toaster } from 'sonner';

import { formatTime } from '@/lib/format';
import { useRealtimeEvent } from './realtime-provider';

interface ChannelTest {
  from: { id: string; fullName: string; academicTitle: string | null };
  sentAt: string;
}

/** Thông báo (toast) cho các sự kiện realtime chung của phân hệ nhân viên y tế. */
export function RealtimeNotifications() {
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
