import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import type { Referral } from '@/lib/data/types';

/** Kết quả gửi lệnh: bao nhiêu bác sĩ trực đã nhận cảnh báo; nếu không ai — nhắc gọi đường dây nóng. */
export function SentBanner({ referral, delivered }: { referral: Referral; delivered: number }) {
  const to = referral.toFacility;
  if (delivered > 0)
    return (
      <p
        role="status"
        className="flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200"
      >
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Đã gửi lệnh <span className="font-mono font-semibold">{referral.code}</span> — {delivered}{' '}
          kết nối trực tại {to.name} đã nhận cảnh báo.
        </span>
      </p>
    );
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        Đã lưu lệnh <span className="font-mono font-semibold">{referral.code}</span> nhưng {to.name}{' '}
        hiện không có bác sĩ trực trực tuyến.{' '}
        <span className="font-semibold">
          Gọi ngay đường dây nóng {to.emergencyPhone ?? to.phone ?? 'của bệnh viện'}
        </span>{' '}
        để báo trước.
      </span>
    </p>
  );
}
