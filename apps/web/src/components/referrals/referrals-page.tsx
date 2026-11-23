import Link from 'next/link';
import { Suspense } from 'react';
import { Ambulance } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { listReferrals } from '@/lib/data/referrals';
import { ReferralLiveRefresh } from './referral-live-refresh';
import { ReferralTable } from './referral-table';
import { SentBanner } from './sent-banner';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function Lists({
  searchParams,
  portal,
}: {
  searchParams: SearchParams;
  portal: 'commune' | 'province';
}) {
  const sp = await searchParams;
  const [outgoing, incoming] = await Promise.all([
    listReferrals('outgoing'),
    portal === 'province' ? listReferrals('incoming') : Promise.resolve([]),
  ]);
  const sent = typeof sp.sent === 'string' ? outgoing.find((r) => r.code === sp.sent) : undefined;
  return (
    <>
      {sent && <SentBanner referral={sent} delivered={Number(sp.delivered ?? 0)} />}
      {sent && typeof sp.pickup === 'string' && (
        <p
          role="status"
          data-testid="pickup-banner"
          className="rounded-lg border border-sky-300 bg-sky-50 p-3 text-sm text-sky-950 dark:bg-sky-500/10 dark:text-sky-100"
        >
          Đã gửi <span className="font-semibold">yêu cầu xe đón</span> tới {sp.pickup} cơ sở có xe
          cứu thương. Cơ sở nhận trước sẽ được giao ca — bạn nhận thông báo xe nào tới đón và giờ dự
          kiến.
        </p>
      )}
      {portal === 'province' && (
        <section className="flex flex-col gap-3" aria-labelledby="in-heading">
          <h2 id="in-heading" className="text-lg font-semibold">
            Gửi tới bệnh viện
          </h2>
          <ReferralTable rows={incoming} direction="incoming" portal={portal} />
        </section>
      )}
      {(portal === 'commune' || outgoing.length > 0) && (
        <section className="flex flex-col gap-3" aria-labelledby="out-heading">
          {portal === 'province' && (
            <h2 id="out-heading" className="text-lg font-semibold">
              Bệnh viện chuyển đi (liên tỉnh / tuyến trung ương)
            </h2>
          )}
          <ReferralTable rows={outgoing} direction="outgoing" portal={portal} />
        </section>
      )}
    </>
  );
}

export function ReferralsPage({
  searchParams,
  portal,
}: {
  searchParams: SearchParams;
  portal: 'commune' | 'province';
}) {
  return (
    <>
      <PageHeader
        title={portal === 'commune' ? 'Chuyển tuyến' : 'Ca chuyển tuyến'}
        description={
          portal === 'commune'
            ? 'Các ca đã chuyển lên tuyến trên và phản hồi của bệnh viện nhận.'
            : 'Phiếu chuyển tuyến gửi tới bệnh viện và các ca bệnh viện chuyển đi.'
        }
        actions={
          portal === 'commune' && (
            <Button variant="destructive" asChild>
              <Link href="/commune/referrals/new">
                <Ambulance /> Chuyển tuyến khẩn cấp
              </Link>
            </Button>
          )
        }
      />
      <ReferralLiveRefresh />
      <Suspense
        fallback={<div className="bg-muted/50 h-64 animate-pulse rounded-xl border" aria-busy />}
      >
        <Lists searchParams={searchParams} portal={portal} />
      </Suspense>
    </>
  );
}
