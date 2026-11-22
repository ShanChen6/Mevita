'use client';

import { useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';

/** Thông báo sau khi đặt lịch thành công (?booked=MÃ). */
export function BookedBanner() {
  const code = useSearchParams().get('booked');
  if (!code || !/^LH[A-Z0-9]{6}$/.test(code)) return null;
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200"
    >
      <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
      <p>
        Đặt lịch thành công. Mã lịch hẹn <span className="font-mono font-semibold">{code}</span> —
        vui lòng đọc mã này tại quầy tiếp đón. Cơ sở y tế sẽ xác nhận lịch trong thời gian sớm nhất.
      </p>
    </div>
  );
}
