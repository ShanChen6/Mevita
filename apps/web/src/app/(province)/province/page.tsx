import { connection } from 'next/server';
import { Suspense } from 'react';
import { Ambulance, BellRing, Globe2 } from 'lucide-react';

import { ConnectionStatus } from '@/components/realtime/connection-status';
import { TestSignalButton } from '@/components/realtime/test-signal-button';
import { IncomingReferralCard } from '@/components/referrals/incoming-referral-card';
import { ReferralLiveRefresh } from '@/components/referrals/referral-live-refresh';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { listReferrals } from '@/lib/data/referrals';

async function Incoming() {
  await connection();
  const now = new Date().toISOString();
  const active = await listReferrals('incoming', true);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Chờ tiếp nhận"
          value={active.filter((r) => r.status === 'PENDING').length}
          icon={BellRing}
        />
        <StatCard label="Đang trên đường" value={active.length} icon={Ambulance} />
        <StatCard
          label="Ca liên tỉnh"
          value={active.filter((r) => r.interProvincial).length}
          icon={Globe2}
        />
      </div>
      <section className="flex flex-col gap-3" aria-labelledby="incoming-heading">
        <h2 id="incoming-heading" className="text-lg font-semibold">
          Ca chuyển tuyến đang tới
        </h2>
        {active.length === 0 ? (
          <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
            Không có ca nào đang chuyển tới. Ca mới sẽ hiện ở đây ngay khi tuyến dưới gửi lệnh.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {active.map((r) => (
              <IncomingReferralCard key={r.id} referral={r} now={now} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export default function CoordinationCenterPage() {
  return (
    <>
      <PageHeader
        title="Trung tâm điều phối cấp cứu"
        description="Ca chuyển tuyến tới bệnh viện — sắp theo mức độ ưu tiên và thời gian xe tới."
        actions={
          <>
            <ConnectionStatus detailed />
            <TestSignalButton />
          </>
        }
      />
      <ReferralLiveRefresh />
      <Suspense
        fallback={<div className="bg-muted/50 h-80 animate-pulse rounded-xl border" aria-busy />}
      >
        <Incoming />
      </Suspense>
    </>
  );
}
