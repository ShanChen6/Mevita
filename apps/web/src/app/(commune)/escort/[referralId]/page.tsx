import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { AlertTriangle, ArrowLeft, MapPin, Phone } from 'lucide-react';

import { ConnectionStatus } from '@/components/realtime/connection-status';
import { EscortVitalsForm } from '@/components/referrals/escort-vitals-form';
import { EtaCountdown } from '@/components/referrals/eta-countdown';
import { ReferralLiveRefresh } from '@/components/referrals/referral-live-refresh';
import { PriorityBadge, ReferralStatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { getSession } from '@/lib/auth/session';
import { getReferral, getReferralVitals } from '@/lib/data/referrals';
import { ageAt, formatTime } from '@/lib/format';
import { bloodType, gender } from '@/lib/labels';

async function Escort({ params }: { params: Promise<{ referralId: string }> }) {
  await connection();
  const { referralId } = await params;
  const [r, vitals, session] = await Promise.all([
    getReferral(referralId),
    getReferralVitals(referralId),
    getSession(),
  ]);
  const p = r.patient;
  const active = r.status === 'PENDING' || r.status === 'ACCEPTED';
  const back =
    session?.role === 'PROVINCE_STAFF' ? '/province/referrals' : `/commune/referrals/${r.id}`;
  const hotline = r.toFacility.emergencyPhone ?? r.toFacility.phone;

  return (
    <>
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild aria-label="Quay lại">
          <Link href={back}>
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {p.fullName}{' '}
            <span className="text-muted-foreground text-sm font-normal">
              {gender[p.gender]}, {ageAt(p.dateOfBirth, new Date().toISOString())}t
            </span>
          </p>
          <p className="text-muted-foreground font-mono text-xs">{r.code}</p>
        </div>
        {active && r.estimatedArrivalAt && (
          <EtaCountdown until={r.estimatedArrivalAt} className="text-lg" />
        )}
      </header>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <PriorityBadge priority={r.priority} />
        <ReferralStatusBadge status={r.status} />
        <ConnectionStatus />
      </div>
      <p className="text-muted-foreground flex items-center gap-1 text-sm">
        <MapPin className="size-3.5 shrink-0" aria-hidden /> {r.toFacility.name}
        {hotline && (
          <a
            href={`tel:${hotline.replace(/\s/g, '')}`}
            className="text-primary ml-auto flex items-center gap-1 font-medium"
          >
            <Phone className="size-3.5" aria-hidden /> {hotline}
          </a>
        )}
      </p>
      {p.allergies && (
        <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-500/10 dark:text-red-200">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <span>
            <span className="font-semibold">Dị ứng:</span> {p.allergies} · Nhóm máu{' '}
            {bloodType[p.bloodType]}
          </span>
        </p>
      )}
      {r.preparationNote && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">
          <span className="font-semibold">Tuyến trên: </span>
          {r.preparationNote}
        </p>
      )}
      <ReferralLiveRefresh />

      {r.status === 'ARRIVED' && (
        <p
          className="rounded-lg bg-sky-50 p-3 text-sm text-sky-950 dark:bg-sky-500/10 dark:text-sky-100"
          data-testid="handover"
        >
          <span className="font-semibold">Đã bàn giao bệnh nhân</span> cho {r.toFacility.name}
          {r.arrivedAt && ` lúc ${formatTime(r.arrivedAt)}`}
          {r.receivedBy && ` · ${r.receivedBy.name}`}. Các lần đo còn lưu tạm vẫn được gửi tự động.
        </p>
      )}
      {active || r.status === 'ARRIVED' ? (
        <EscortVitalsForm referralId={r.id} initial={vitals} readOnly={!active} />
      ) : (
        <p className="bg-muted rounded-lg p-4 text-sm">
          Phiếu chuyển tuyến đã kết thúc (
          {r.status === 'CANCELLED' ? `huỷ: ${r.cancellationReason}` : 'không còn trên đường'}) —
          không cần cập nhật sinh tồn.
        </p>
      )}
    </>
  );
}

/** Màn hình tối giản trên điện thoại cho nhân viên y tế đi kèm xe chuyển viện (Task 4.3). */
export default function EscortPage({ params }: PageProps<'/escort/[referralId]'>) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 px-4 py-4">
      <Suspense
        fallback={<div className="bg-muted/50 h-[80svh] animate-pulse rounded-xl" aria-busy />}
      >
        <Escort params={params} />
      </Suspense>
    </main>
  );
}
