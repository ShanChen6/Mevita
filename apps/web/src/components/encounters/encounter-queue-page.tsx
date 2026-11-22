import Link from 'next/link';
import { Suspense } from 'react';
import { AlertTriangle, ChevronRight, Search, Siren, Stethoscope } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getOpenEncounters } from '@/lib/data/encounters';
import { ageAt, formatDate, formatTime } from '@/lib/format';
import { gender } from '@/lib/labels';

async function Queue({ portal }: { portal: 'commune' | 'province' }) {
  const items = await getOpenEncounters();
  const now = new Date().toISOString();
  if (items.length === 0) {
    return (
      <Card className="items-center gap-3 px-6 py-12 text-center">
        <Stethoscope className="text-muted-foreground size-8" aria-hidden />
        <p className="font-medium">Chưa có bệnh nhân chờ khám</p>
        <p className="text-muted-foreground max-w-md text-sm">
          Phiếu khám được tạo khi tiếp đón lịch hẹn hoặc tiếp nhận bệnh nhân đến trực tiếp.
        </p>
        <Button asChild>
          <Link href={`/${portal}/patients`}>
            <Search /> Tra cứu & tiếp nhận bệnh nhân
          </Link>
        </Button>
      </Card>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {items.map((r, i) => (
        <li key={r.id}>
          <Link
            href={`/${portal}/encounters/${r.id}`}
            className="bg-card hover:border-primary hover:bg-primary/5 focus-visible:ring-ring/50 flex items-center gap-4 rounded-xl border p-4 transition-colors focus-visible:outline-none focus-visible:ring-[3px]"
          >
            <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums">
              {i + 1}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{r.patient.fullName}</span>
                <span className="text-muted-foreground text-sm">
                  {gender[r.patient.gender]}, {ageAt(r.patient.dateOfBirth, now)} tuổi
                </span>
                {r.encounterType === 'EMERGENCY' && (
                  <Badge className="gap-1 border-transparent bg-red-600 text-white">
                    <Siren /> Cấp cứu
                  </Badge>
                )}
              </span>
              <span className="text-sm">{r.chiefComplaint}</span>
              <span className="text-muted-foreground flex flex-wrap gap-x-3 text-xs">
                <span className="font-mono">{r.code}</span>
                <span>
                  {r.appointment
                    ? `Lịch hẹn ${formatTime(r.appointment.startAt)}`
                    : `Đến lúc ${formatTime(r.createdAt)} · ${formatDate(r.createdAt)}`}
                </span>
                {r.specialty && <span>{r.specialty.name}</span>}
              </span>
              {r.patient.allergies && (
                <span className="text-destructive flex items-center gap-1 text-xs font-medium">
                  <AlertTriangle className="size-3" aria-hidden /> Dị ứng: {r.patient.allergies}
                </span>
              )}
            </span>
            <ChevronRight className="text-muted-foreground size-5 shrink-0" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Hàng đợi khám (phiếu nháp đang mở) — ca cấp cứu lên đầu. */
export function EncounterQueuePage({ portal }: { portal: 'commune' | 'province' }) {
  return (
    <>
      <PageHeader
        title="Khám bệnh"
        description="Bệnh nhân đã tiếp đón đang chờ khám. Ca cấp cứu được xếp lên đầu."
        actions={
          <Button variant="outline" asChild>
            <Link href={`/${portal}/patients`}>
              <Search /> Tiếp nhận bệnh nhân
            </Link>
          </Button>
        }
      />
      <Suspense
        fallback={<div className="bg-muted/50 h-64 animate-pulse rounded-xl border" aria-busy />}
      >
        <Queue portal={portal} />
      </Suspense>
    </>
  );
}
