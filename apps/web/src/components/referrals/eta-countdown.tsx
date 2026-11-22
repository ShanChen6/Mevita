'use client';

import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Đếm ngược thời gian xe dự kiến tới nơi.
 * Wireframe: tính từ lúc mở trang + `minutes`. Bản thật dùng `estimatedArrivalAt` từ API (Task 4.4).
 */
export function EtaCountdown({ minutes, className }: { minutes: number; className?: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const target = Date.now() + minutes * 60_000;
    const tick = () => setRemaining(Math.max(0, Math.round((target - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [minutes]);

  const mm = remaining === null ? '--' : String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = remaining === null ? '--' : String(remaining % 60).padStart(2, '0');
  const urgent = remaining !== null && remaining < 10 * 60;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-mono font-semibold tabular-nums',
        urgent && 'text-red-600 dark:text-red-400',
        className,
      )}
      role="timer"
      aria-label="Thời gian xe dự kiến tới"
    >
      <Timer className="size-4" aria-hidden />
      {remaining === 0 ? 'Đã tới' : `${mm}:${ss}`}
    </span>
  );
}
