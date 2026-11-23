'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { AlertTriangle, Building2, Siren, Stethoscope, Volume2, VolumeX } from 'lucide-react';

import { EtaCountdown } from '@/components/referrals/eta-countdown';
import { PriorityBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { installAudioUnlock, playAlert, type SoundState } from '@/lib/alert-sound';
import type { IncomingReferralAlert, ReferralUpdatedEvent } from '@/lib/data/types';
import { ageAt, formatTime } from '@/lib/format';
import { bloodType, gender } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { useRealtimeEvent } from './realtime-provider';

const RANK = { CRITICAL: 0, URGENT: 1, ROUTINE: 2 } as const;

/**
 * Popup toàn màn hình + âm thanh khi có ca chuyển tuyến mới tới bệnh viện (Task 4.4).
 * Nhiều ca cùng lúc: xếp hàng theo mức độ ưu tiên. Ca được đồng nghiệp xử lý/bị huỷ thì tự gỡ khỏi hàng.
 */
export function IncomingAlertDialog({
  onResolved,
}: {
  onResolved?: (e: ReferralUpdatedEvent) => void;
}) {
  const router = useRouter();
  const [queue, setQueue] = useState<IncomingReferralAlert[]>([]);
  const [sound, setSound] = useState<SoundState | null>(null);
  const stopRef = useRef<() => void>(() => {});
  const current = queue[0];

  useEffect(() => installAudioUnlock(), []);

  useRealtimeEvent<IncomingReferralAlert>('new_incoming_referral', (a) => {
    setQueue((q) =>
      [...q.filter((x) => x.id !== a.id), a].sort((x, y) => RANK[x.priority] - RANK[y.priority]),
    );
    // Ca khẩn hơn ca đang kêu thì đổi sang âm báo của ca mới
    if (!current || RANK[a.priority] <= RANK[current.priority]) {
      stopRef.current();
      const res = playAlert(a.priority);
      stopRef.current = res.stop;
      setSound(res.state);
    }
  });

  useRealtimeEvent<ReferralUpdatedEvent>('referral_updated', (e) => {
    if (e.side !== 'incoming' || !queue.some((x) => x.id === e.id)) return;
    dismiss(e.id);
    onResolved?.(e);
  });

  function dismiss(id: string) {
    setQueue((q) => {
      const rest = q.filter((x) => x.id !== id);
      if (rest.length === 0) {
        stopRef.current();
        setSound(null);
      }
      return rest;
    });
  }

  function retrySound() {
    if (!current) return;
    stopRef.current();
    const res = playAlert(current.priority);
    stopRef.current = res.stop;
    setSound(res.state);
  }

  if (!current) return null;
  const p = current.patient;
  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && dismiss(current.id)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 animate-pulse bg-red-950/60" />
        <DialogPrimitive.Content
          data-testid="incoming-alert"
          className={cn(
            'bg-background fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-xl border-4 p-6 shadow-2xl',
            current.priority === 'CRITICAL' && 'border-red-600',
            current.priority === 'URGENT' && 'border-orange-500',
            current.priority === 'ROUTINE' && 'border-sky-400',
          )}
        >
          <div className="flex items-center gap-2">
            <Siren className="size-6 animate-bounce text-red-600" aria-hidden />
            <DialogPrimitive.Title className="text-xl font-bold">
              Ca chuyển tuyến mới
            </DialogPrimitive.Title>
            <span className="text-muted-foreground ml-auto font-mono text-sm">{current.code}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={current.priority} />
            {current.estimatedArrivalAt && (
              <span className="flex items-center gap-1 rounded-md border px-2 py-0.5 text-sm">
                Xe tới sau <EtaCountdown until={current.estimatedArrivalAt} />
              </span>
            )}
            {queue.length > 1 && (
              <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                +{queue.length - 1} ca khác
              </span>
            )}
          </div>
          <DialogPrimitive.Description asChild>
            <div className="flex flex-col gap-2">
              <p className="text-lg font-semibold">
                {p.fullName}{' '}
                <span className="text-muted-foreground text-sm font-normal">
                  {gender[p.gender]}, {ageAt(p.dateOfBirth, current.createdAt)} tuổi · Nhóm máu{' '}
                  {bloodType[p.bloodType]}
                </span>
              </p>
              <p>
                {current.diagnosis
                  ? `${current.diagnosis.icdCode} ${current.diagnosis.name}`
                  : current.reason}
              </p>
              {current.diagnosis && (
                <p className="text-muted-foreground text-sm">{current.reason}</p>
              )}
              {p.allergies && (
                <p className="flex items-center gap-1.5 font-semibold text-red-700 dark:text-red-400">
                  <AlertTriangle className="size-4" aria-hidden /> Dị ứng: {p.allergies}
                </p>
              )}
              <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                <Building2 className="size-3.5" aria-hidden /> {current.fromFacility.name},{' '}
                {current.fromFacility.province} · gửi lúc {formatTime(current.createdAt)}
              </p>
              {current.referredBy && (
                <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                  <Stethoscope className="size-3.5" aria-hidden /> {current.referredBy}
                </p>
              )}
            </div>
          </DialogPrimitive.Description>
          {sound === 'blocked' ? (
            <Button variant="outline" size="sm" className="self-start" onClick={retrySound}>
              <Volume2 /> Bật âm thanh cảnh báo
            </Button>
          ) : (
            <p
              className="text-muted-foreground flex items-center gap-1.5 text-xs"
              data-testid="alert-sound"
              data-state={sound ?? ''}
            >
              {sound === 'playing' ? (
                <Volume2 className="size-3.5" aria-hidden />
              ) : (
                <VolumeX className="size-3.5" aria-hidden />
              )}
              {sound === 'playing' ? 'Đang phát âm thanh cảnh báo' : 'Âm thanh cảnh báo đang tắt'}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => dismiss(current.id)}>
              Để sau
            </Button>
            <Button
              size="lg"
              onClick={() => {
                const id = current.id;
                dismiss(id);
                router.push(`/province/referrals/${id}`);
              }}
            >
              Xem hồ sơ & tiếp nhận
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
