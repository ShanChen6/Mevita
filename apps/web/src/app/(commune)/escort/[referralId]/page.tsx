import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MapPin } from 'lucide-react';

import { EscortVitalsForm } from '@/components/referrals/escort-vitals-form';
import { EtaCountdown } from '@/components/referrals/eta-countdown';
import { PriorityBadge, ReferralStatusBadge } from '@/components/shared/status-badge';
import { WireframeNote } from '@/components/shared/wireframe-note';
import { Button } from '@/components/ui/button';
import { findReferral, referrals } from '@/lib/mock-data';

export const metadata: Metadata = { title: 'Cập nhật trên xe · Mevita' };

export function generateStaticParams() {
  return referrals.map((r) => ({ referralId: r.id }));
}

/** Màn hình tối giản trên điện thoại cho nhân viên y tế đi kèm xe chuyển viện (Task 4.3). */
export default async function EscortPage({ params }: PageProps<'/escort/[referralId]'>) {
  const { referralId } = await params;
  const referral = findReferral(referralId);
  if (!referral) notFound();

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col gap-4 px-4 py-4">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild aria-label="Quay lại">
          <Link href="/commune/referrals">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{referral.patient.fullName}</p>
          <p className="text-muted-foreground font-mono text-xs">{referral.code}</p>
        </div>
        <EtaCountdown minutes={referral.etaMinutes} className="text-lg" />
      </header>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <PriorityBadge priority={referral.priority} />
        <ReferralStatusBadge status={referral.status} />
        <span className="text-muted-foreground flex items-center gap-1">
          <MapPin className="size-3.5" aria-hidden /> {referral.to.name}
        </span>
      </div>

      {referral.preparationNote && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">
          <span className="font-semibold">Tuyến trên: </span>
          {referral.preparationNote}
        </p>
      )}

      <EscortVitalsForm />
      <WireframeNote task="4.3" />
    </main>
  );
}
