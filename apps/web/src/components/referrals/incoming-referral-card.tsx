import Link from 'next/link';
import { AlertTriangle, Building2, HeartPulse, Stethoscope } from 'lucide-react';

import { PriorityBadge, ReferralStatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Referral } from '@/lib/data/types';
import { ageAt } from '@/lib/format';
import { gender } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { EtaCountdown } from './eta-countdown';

export function IncomingReferralCard({ referral: r, now }: { referral: Referral; now: string }) {
  const s = r.sourceRecord;
  const primary = s.diagnoses.find((d) => d.isPrimary) ?? s.diagnoses[0];
  return (
    <Card
      data-testid={`incoming-${r.code}`}
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
          {r.estimatedArrivalAt && (
            <EtaCountdown until={r.estimatedArrivalAt} className="ml-auto" />
          )}
        </div>
        <CardTitle className="text-lg">
          {r.patient.fullName}{' '}
          <span className="text-muted-foreground text-sm font-normal">
            {gender[r.patient.gender]}, {ageAt(r.patient.dateOfBirth, now)} tuổi
          </span>
        </CardTitle>
        <p className="text-sm">{primary ? `${primary.icdCode} ${primary.name}` : r.reason}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {r.patient.allergies && (
          <p className="flex items-center gap-1.5 font-medium text-red-700 dark:text-red-400">
            <AlertTriangle className="size-3.5" aria-hidden /> Dị ứng: {r.patient.allergies}
          </p>
        )}
        <div className="text-muted-foreground flex flex-col gap-1">
          <span className="flex items-center gap-1.5">
            <Building2 className="size-3.5" aria-hidden /> {r.fromFacility.name},{' '}
            {r.fromFacility.commune.province.fullName}
          </span>
          <span className="flex items-center gap-1.5">
            <Stethoscope className="size-3.5" aria-hidden /> {r.referredBy.name}
          </span>
        </div>
        {(s.pulse != null || s.spo2 != null) && (
          <p className="bg-muted flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-3 py-2 font-medium tabular-nums">
            <HeartPulse className="size-4 text-red-500" aria-hidden />
            {s.pulse != null && <span>M {s.pulse}</span>}
            {s.systolicBp != null && (
              <span>
                HA {s.systolicBp}/{s.diastolicBp}
              </span>
            )}
            {s.spo2 != null && (
              <span className={cn(s.spo2 < 94 && 'text-red-600 dark:text-red-400')}>
                SpO2 {s.spo2}%
              </span>
            )}
            <span className="text-muted-foreground text-xs font-normal">lúc khám</span>
          </p>
        )}
        <Button
          asChild
          variant={r.status === 'PENDING' ? 'default' : 'outline'}
          className="self-start"
        >
          <Link href={`/province/referrals/${r.id}`}>
            {r.status === 'PENDING' ? 'Xem hồ sơ ca bệnh' : 'Xem chi tiết'}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
