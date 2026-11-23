import Link from 'next/link';
import { ArrowRightLeft, Building2, Flag, Hospital, MapPin, Truck } from 'lucide-react';

import { PriorityBadge, ReferralStatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Journey, JourneyHop, VitalLog } from '@/lib/data/types';
import { formatDateTime } from '@/lib/format';
import { transportMode } from '@/lib/labels';
import { cn } from '@/lib/utils';

export function formatMinutes(m: number) {
  if (m < 60) return `${m} phút`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} giờ ${m % 60} phút` : `${h} giờ`;
}

function vitalText(v: VitalLog) {
  return [
    v.pulse != null && `M ${v.pulse}`,
    v.systolicBp != null && `HA ${v.systolicBp}/${v.diastolicBp}`,
    v.spo2 != null && `SpO2 ${v.spo2}%`,
    v.gcs != null && `GCS ${v.gcs}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Ca được nhận để ổn định, đã tới nơi nhưng chưa lập chặng tiếp theo. */
export function awaitingForward(j: Journey) {
  const last = j.hops.at(-1);
  return !!last && last.status === 'ARRIVED' && last.acceptanceType === 'STABILIZE_FORWARD';
}

function HopVitals({ vitals }: { vitals: VitalLog[] }) {
  if (vitals.length === 0) return null;
  const first = vitals[0];
  const last = vitals.at(-1)!;
  return (
    <p className="text-muted-foreground text-xs">
      Sinh tồn trên xe ({vitals.length} lần đo): {vitalText(first)}
      {vitals.length > 1 && (
        <>
          {' '}
          → <span className="text-foreground font-medium">{vitalText(last)}</span>
        </>
      )}
    </p>
  );
}

function Hop({ h, current, portal }: { h: JourneyHop; current: boolean; portal: string }) {
  const done = h.status === 'ARRIVED';
  const dead = h.status === 'CANCELLED' || h.status === 'REJECTED';
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0" data-testid="journey-hop">
      <span
        className={cn(
          'z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold',
          done
            ? 'border-violet-500 bg-violet-500 text-white'
            : dead
              ? 'border-muted-foreground/40 bg-muted text-muted-foreground'
              : 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/10',
        )}
        aria-hidden
      >
        {h.index}
      </span>
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col gap-1.5 rounded-lg border p-3',
          current && 'border-primary ring-primary/30 ring-2',
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Hospital className="text-muted-foreground size-4" aria-hidden />
          <span className="font-semibold">{h.to.name}</span>
          <span className="text-muted-foreground text-sm">{h.to.province}</span>
          {current && <Badge variant="outline">Đang xem</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <PriorityBadge priority={h.priority} />
          <ReferralStatusBadge status={h.status} />
          {h.interProvincial && <Badge variant="outline">Liên tỉnh</Badge>}
          {h.acceptanceType === 'STABILIZE_FORWARD' && (
            <Badge className="border-transparent bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300">
              Ổn định rồi chuyển tiếp
            </Badge>
          )}
        </div>
        <p className="text-sm">
          <span className="text-muted-foreground">Từ</span> {h.from.name} ·{' '}
          <span className="text-muted-foreground">lệnh</span>{' '}
          <span className="font-mono text-xs">{h.code}</span>
        </p>
        <p className="text-muted-foreground text-xs">
          Gửi {formatDateTime(h.createdAt)}
          {h.acceptedAt && ` · tiếp nhận ${formatDateTime(h.acceptedAt)}`}
          {h.arrivedAt && ` · tới ${formatDateTime(h.arrivedAt)}`}
          {h.cancelledAt && ` · huỷ ${formatDateTime(h.cancelledAt)}`}
        </p>
        {(h.vehicle || h.transportMode) && (
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <Truck className="size-3.5" aria-hidden />
            {[h.transportMode && transportMode[h.transportMode], h.vehicle]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        <HopVitals vitals={h.vitals} />
        {h.forwardNote && (
          <p className="rounded-md bg-sky-50 px-2 py-1 text-xs text-sky-900 dark:bg-sky-500/10 dark:text-sky-200">
            <span className="font-semibold">Kế hoạch chuyển tiếp:</span> {h.forwardNote}
          </p>
        )}
        {h.status === 'REJECTED' && h.redirectFacility && (
          <p className="text-muted-foreground text-xs">
            Đề nghị chuyển tới {h.redirectFacility.name}
          </p>
        )}
        {!current && (
          <Link
            href={`/${portal}/referrals/${h.id}`}
            className="text-primary self-start text-xs underline-offset-2 hover:underline"
          >
            Xem phiếu chặng {h.index}
          </Link>
        )}
      </div>
    </li>
  );
}

/**
 * Hành trình nhiều chặng (Task A): nơi khám đầu tiên → từng chặng chuyển tuyến → nơi điều trị hiện tại.
 * Mọi cơ sở tham gia đều thấy cả chuỗi để điều trị liên tục (tuyến TW biết diễn biến từ tuyến xã).
 */
export function JourneyTimeline({
  journey: j,
  portal,
  viewerFacilityId,
}: {
  journey: Journey;
  portal: string;
  viewerFacilityId?: string | null;
}) {
  const last = j.hops.at(-1)!;
  const pending = awaitingForward(j);
  const canForward = pending && !!last.continuationRecord && last.to.id === viewerFacilityId;
  return (
    <Card data-testid="journey-timeline">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft className="size-5" aria-hidden /> Hành trình chuyển tuyến
        </CardTitle>
        <CardDescription>
          {j.hops.length} chặng · {j.origin.facility.province} → {last.to.province}
          {j.totalMinutes != null &&
            j.completed &&
            !pending &&
            ` · tổng ${formatMinutes(j.totalMinutes)} từ lúc gửi lệnh đầu tiên`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="before:bg-border relative flex flex-col before:absolute before:bottom-2 before:left-3.5 before:top-2 before:w-0.5">
          <li className="relative flex gap-3 pb-5">
            <span
              className="bg-background z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500 text-emerald-600"
              aria-hidden
            >
              <MapPin className="size-3.5" />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5 pt-0.5 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <Building2 className="text-muted-foreground size-4" aria-hidden />
                <span className="font-semibold">{j.origin.facility.name}</span>
                <span className="text-muted-foreground">{j.origin.facility.province}</span>
              </p>
              <p className="text-muted-foreground text-xs">
                Khám lần đầu {formatDateTime(j.origin.visitAt)} · phiếu {j.origin.recordCode}
              </p>
              <p>
                {j.origin.diagnosis ? (
                  <>
                    <span className="font-mono text-xs font-semibold">
                      {j.origin.diagnosis.icdCode}
                    </span>{' '}
                    {j.origin.diagnosis.name}
                  </>
                ) : (
                  j.origin.chiefComplaint
                )}
              </p>
            </div>
          </li>
          {j.hops.map((h) => (
            <Hop key={h.id} h={h} current={h.id === j.current} portal={portal} />
          ))}
          {pending && (
            <li className="relative flex gap-3" data-testid="journey-next">
              <span
                className="bg-background z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-sky-500 text-sky-600"
                aria-hidden
              >
                <Flag className="size-3.5" />
              </span>
              <div className="flex flex-1 flex-col gap-2 rounded-lg border border-dashed border-sky-400 p-3 text-sm">
                <p className="font-medium">Chờ chuyển tiếp lên tuyến cao hơn</p>
                <p className="text-muted-foreground text-xs">
                  {last.to.name} đang ổn định người bệnh theo kế hoạch đã thống nhất.
                </p>
                {canForward && (
                  <Button size="sm" className="self-start" asChild>
                    <Link href={`/${portal}/referrals/new?record=${last.continuationRecord!.id}`}>
                      Lập lệnh chuyển tiếp
                    </Link>
                  </Button>
                )}
              </div>
            </li>
          )}
        </ol>
      </CardContent>
    </Card>
  );
}
