'use client';

import { useRouter } from 'next/navigation';
import { toast, Toaster } from 'sonner';

import type { ReferralUpdatedEvent } from '@/lib/data/types';
import { formatTime } from '@/lib/format';
import { IncomingAlertDialog } from './incoming-alert-dialog';
import { useRealtimeEvent } from './realtime-provider';

interface ChannelTest {
  from: { id: string; fullName: string; academicTitle: string | null };
  sentAt: string;
}

/** Popup ca mới + thông báo (toast) các sự kiện realtime của phân hệ nhân viên y tế. */
export function RealtimeNotifications({ offset = 72 }: { offset?: number }) {
  const router = useRouter();

  useRealtimeEvent<ReferralUpdatedEvent>('referral_updated', (e) => {
    const id = `update-${e.id}-${e.action}`;
    if (e.side === 'outgoing') {
      // Phản hồi của bệnh viện nhận cho tuyến dưới / người đi kèm
      if (e.action === 'accept')
        toast.success(`${e.toFacility} đã tiếp nhận ca ${e.code} — ê-kíp sẵn sàng`, {
          id,
          duration: 20_000,
          description: [e.patientName, e.by && `Xác nhận bởi ${e.by}`, e.preparationNote]
            .filter(Boolean)
            .join(' · '),
        });
      else if (e.action === 'arrive')
        toast.success(`${e.toFacility} đã tiếp nhận bệnh nhân ${e.patientName}`, {
          id,
          description: `Bàn giao xong ca ${e.code}${e.by ? ` — ${e.by}` : ''}.`,
        });
      else if (e.action === 'preparation')
        toast.info(`${e.toFacility} cập nhật chuẩn bị cho ca ${e.code}`, {
          id,
          description: e.preparationNote,
        });
      else if (e.action === 'reject')
        toast.error(`${e.toFacility} không thể tiếp nhận ca ${e.code}`, {
          id,
          duration: Infinity,
          description: `${e.rejectionReason ?? ''} — hãy chuyển tới bệnh viện khác.`,
          action: {
            label: 'Chuyển nơi khác',
            onClick: () => {
              // Đọc lúc bấm (không dùng usePathname để khung giao diện vẫn dựng sẵn được)
              const portal = window.location.pathname.startsWith('/province')
                ? 'province'
                : 'commune';
              router.push(`/${portal}/referrals/new?record=${e.sourceRecordId}`);
            },
          },
        });
      return;
    }
    if (e.action === 'cancel')
      toast.warning(`Tuyến dưới đã huỷ lệnh ${e.code}`, { id, description: e.cancellationReason });
  });

  useRealtimeEvent<ChannelTest>('channel_test', (e) => {
    const who = e.from.academicTitle
      ? `${e.from.academicTitle}. ${e.from.fullName}`
      : e.from.fullName;
    toast.info('Tín hiệu kiểm tra kênh trực', {
      description: `Từ ${who} lúc ${formatTime(e.sentAt)} — kết nối thông suốt.`,
    });
  });

  return (
    <>
      <IncomingAlertDialog
        onResolved={(e) => {
          if (e.action === 'accept' || e.action === 'reject')
            toast.info(
              `${e.by ?? 'Đồng nghiệp'} đã ${e.action === 'accept' ? 'tiếp nhận' : 'từ chối'} ca ${e.code}`,
            );
        }}
      />
      <Toaster
        position="top-right"
        richColors
        closeButton
        offset={offset}
        mobileOffset={{ top: offset - 8 }}
      />
    </>
  );
}
