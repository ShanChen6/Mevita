import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { CalendarPlus, CalendarX2 } from 'lucide-react';

import { AppointmentCard } from '@/components/appointments/appointment-card';
import { BookedBanner } from '@/components/appointments/booked-banner';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getMyAppointments } from '@/lib/data/appointments';

export const metadata: Metadata = { title: 'Lịch hẹn của tôi' };

async function Lists() {
  const [upcoming, past] = await Promise.all([
    getMyAppointments('upcoming'),
    getMyAppointments('past'),
  ]);
  const now = new Date().toISOString();
  return (
    <>
      <section className="flex flex-col gap-3" aria-labelledby="upcoming">
        <h2 id="upcoming" className="text-lg font-semibold">
          Sắp tới{' '}
          <span className="text-muted-foreground text-sm font-normal">({upcoming.length})</span>
        </h2>
        {upcoming.length === 0 ? (
          <Card className="items-center gap-3 px-6 py-10 text-center">
            <CalendarX2 className="text-muted-foreground size-8" aria-hidden />
            <p className="text-muted-foreground text-sm">Bạn chưa có lịch hẹn nào sắp tới.</p>
            <Button asChild size="sm">
              <Link href="/patient/appointments/new">Đặt lịch khám</Link>
            </Button>
          </Card>
        ) : (
          upcoming.map((a) => (
            <AppointmentCard
              key={a.id}
              appointment={a}
              cancellable={(a.status === 'PENDING' || a.status === 'CONFIRMED') && a.startAt > now}
            />
          ))
        )}
      </section>

      {past.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="past">
          <h2 id="past" className="text-lg font-semibold">
            Đã qua / đã huỷ
          </h2>
          {past.map((a) => (
            <AppointmentCard key={a.id} appointment={a} cancellable={false} />
          ))}
        </section>
      )}
    </>
  );
}

export default function MyAppointmentsPage() {
  return (
    <>
      <PageHeader
        title="Lịch hẹn của tôi"
        actions={
          <Button asChild>
            <Link href="/patient/appointments/new">
              <CalendarPlus /> Đặt lịch mới
            </Link>
          </Button>
        }
      />
      <Suspense>
        <BookedBanner />
      </Suspense>
      <Suspense
        fallback={<div className="bg-muted/50 h-64 animate-pulse rounded-xl border" aria-busy />}
      >
        <Lists />
      </Suspense>
    </>
  );
}
