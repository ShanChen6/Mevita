import Link from 'next/link';
import { Building2, HeartPulse, Stethoscope } from 'lucide-react';

import { PriorityBadge, ReferralStatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ageAt } from '@/lib/format';
import { MOCK_NOW, type MockReferral } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import { EtaCountdown } from './eta-countdown';

export function IncomingReferralCard({ referral: r }: { referral: MockReferral }) {
  const last = r.vitals.at(-1);
  return (
    <Card
      className={cn(
        'gap-4 border-l-4',
        r.priority === 'CRITICAL' && 'border-l-red-600',
        r.priority === 'URGENT' && 'border-l-orange-500',
        r.priority === 'ROUTINE' && 'border-l-sky-400',
      )}
    >
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge priority={r.priority} />
          <ReferralStatusBadge status={r.status} />
          {r.status !== 'ARRIVED' && <EtaCountdown minutes={r.etaMinutes} className="ml-auto" />}
        </div>
        <CardTitle className="text-lg">
          {r.patient.fullName}{' '}
          <span className="text-muted-foreground text-sm font-normal">
            {r.patient.gender}, {ageAt(r.patient.dateOfBirth, MOCK_NOW)} tuổi
          </span>
        </CardTitle>
        <p className="text-sm">{r.diagnosis}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="text-muted-foreground flex flex-col gap-1">
          <span className="flex items-center gap-1.5">
            <Building2 className="size-3.5" aria-hidden /> {r.from.name}, {r.from.provinceName}
          </span>
          <span className="flex items-center gap-1.5">
            <Stethoscope className="size-3.5" aria-hidden /> {r.referredBy}
          </span>
        </div>
        {last && (
          <p className="bg-muted flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-3 py-2 font-medium tabular-nums">
            <HeartPulse className="size-4 text-red-500" aria-hidden />
            <span>M {last.pulse}</span>
            <span>
              HA {last.systolicBp}/{last.diastolicBp}
            </span>
            <span className={cn(last.spo2 < 94 && 'text-red-600 dark:text-red-400')}>
              SpO2 {last.spo2}%
            </span>
            <span>GCS {last.gcs}</span>
          </p>
        )}
        <Button
          asChild
          variant={r.status === 'PENDING' ? 'default' : 'outline'}
          className="self-start"
        >
          <Link href={`/province/referrals/${r.id}`}>
            {r.status === 'PENDING' ? 'Xem & tiếp nhận' : 'Xem chi tiết'}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
