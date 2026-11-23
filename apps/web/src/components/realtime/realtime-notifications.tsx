'use client';

import { useRouter } from 'next/navigation';
import { toast, Toaster } from 'sonner';

import { playAlert } from '@/lib/alert-sound';
import type { ReferralPriorityValue, ReferralUpdatedEvent } from '@/lib/data/types';
import { referralPriority } from '@/lib/labels';
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
      else if (e.action === 'dispatch')
        toast.success(
          `${e.vehicle?.facility ?? 'Cơ sở'} cử xe ${e.vehicle?.plateNumber ?? ''} tới đón ca ${e.code}`,
          {
            id,
            duration: 20_000,
            description: e.estimatedArrivalAt
              ? `Dự kiến tới bệnh viện lúc ${formatTime(e.estimatedArrivalAt)}`
              : undefined,
          },
        );
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
    else if (e.action === 'picked_up')
      toast.info(`Xe đã đón bệnh nhân ca ${e.code}, đang trên đường tới`, {
        id,
        description: e.estimatedArrivalAt
          ? `Dự kiến tới lúc ${formatTime(e.estimatedArrivalAt)}`
          : undefined,
      });
    else if (e.action === 'dispatch' && e.vehicle)
      toast.info(`Ca ${e.code}: ${e.vehicle.facility} cử xe ${e.vehicle.plateNumber} đi đón`, {
        id,
      });
  });

  // Xe chuyển viện (Task C)
  useRealtimeEvent<{
    id: string;
    code: string;
    priority: ReferralPriorityValue;
    reason: string;
    fromFacility: { name: string; phone: string | null };
    distanceKm: number | null;
  }>('pickup_request', (e) => {
    playAlert(e.priority === 'ROUTINE' ? 'ROUTINE' : 'URGENT');
    toast.warning(`Yêu cầu xe đón ${e.code} · ${referralPriority[e.priority].label}`, {
      id: `pickup-${e.id}`,
      duration: e.priority === 'CRITICAL' ? Infinity : 60_000,
      description: `${e.fromFacility.name}${e.distanceKm != null ? ` · cách ${e.distanceKm.toLocaleString('vi-VN')} km` : ''} — ${e.reason}`,
      action: {
        label: 'Cử xe',
        onClick: () =>
          router.push(
            window.location.pathname.startsWith('/province')
              ? '/province#pickup'
              : '/commune#pickup',
          ),
      },
    });
  });
  useRealtimeEvent<{ id: string; code: string; assignedTo: string; plateNumber: string }>(
    'pickup_closed',
    (e) => {
      toast.dismiss(`pickup-${e.id}`);
      toast.info(`Yêu cầu xe đón ${e.code} đã được ${e.assignedTo} nhận (xe ${e.plateNumber})`);
    },
  );
  useRealtimeEvent<{ id: string; code: string; remainingKm: number | null }>(
    'vehicle_arriving',
    (e) => {
      playAlert('ROUTINE');
      toast.warning(`Xe ca ${e.code} sắp tới — chuẩn bị tiếp đón`, {
        id: `arriving-${e.id}`,
        duration: 60_000,
        description:
          e.remainingKm != null
            ? `Còn khoảng ${e.remainingKm.toLocaleString('vi-VN')} km`
            : undefined,
      });
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
