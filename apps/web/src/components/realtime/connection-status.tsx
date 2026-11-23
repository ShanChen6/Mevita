'use client';

import { Radio, Users, WifiOff } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useRealtime } from './realtime-provider';

const LABEL = {
  connecting: 'Đang kết nối…',
  connected: 'Đang trực',
  reconnecting: 'Mất kết nối — đang thử lại',
  unauthorized: 'Phiên hết hạn — đang thử lại',
} as const;

/** Trạng thái kênh realtime + số đồng nghiệp đang trực cùng cơ sở. */
export function ConnectionStatus({ detailed = false }: { detailed?: boolean }) {
  const { status, onDuty } = useRealtime();
  const ok = status === 'connected';
  const names = onDuty
    .map((s) => (s.academicTitle ? `${s.academicTitle}. ${s.fullName}` : s.fullName))
    .join(', ');
  return (
    <span
      role="status"
      title={ok && names ? `Đang trực: ${names}` : LABEL[status]}
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium',
        ok
          ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200'
          : 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200',
      )}
    >
      {ok ? (
        <span className="relative flex size-2" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
      ) : status === 'connecting' ? (
        <Radio className="size-3.5 animate-pulse" aria-hidden />
      ) : (
        <WifiOff className="size-3.5" aria-hidden />
      )}
      <span className={cn(!detailed && 'hidden sm:inline')}>{LABEL[status]}</span>
      {ok && (
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Users className="size-3.5" aria-hidden />
          {onDuty.length}
          {detailed && <span className="sr-only sm:not-sr-only"> người</span>}
        </span>
      )}
    </span>
  );
}
