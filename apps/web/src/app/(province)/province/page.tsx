import { Ambulance, BellRing, BedDouble, CheckCircle2 } from 'lucide-react';

import { ConnectionStatus } from '@/components/realtime/connection-status';
import { TestSignalButton } from '@/components/realtime/test-signal-button';
import { IncomingReferralCard } from '@/components/referrals/incoming-referral-card';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { WireframeNote } from '@/components/shared/wireframe-note';
import { facilities, referrals } from '@/lib/mock-data';

const priorityOrder = { CRITICAL: 0, URGENT: 1, ROUTINE: 2 } as const;

export default function CoordinationCenterPage() {
  const incoming = referrals
    .filter((r) => r.to.id === facilities.laoCaiGeneral.id)
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  const active = incoming.filter((r) => r.status === 'PENDING' || r.status === 'ACCEPTED');

  return (
    <>
      <PageHeader
        title="Trung tâm điều phối cấp cứu"
        description={facilities.laoCaiGeneral.name}
        actions={
          <>
            <ConnectionStatus detailed />
            <TestSignalButton />
          </>
        }
      />
      <WireframeNote task="4.2, 4.4">
        ca mới hiện popup kèm âm thanh cảnh báo trong dưới 1 giây
      </WireframeNote>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Chờ tiếp nhận"
          value={incoming.filter((r) => r.status === 'PENDING').length}
          icon={BellRing}
        />
        <StatCard label="Đang trên đường" value={active.length} icon={Ambulance} />
        <StatCard
          label="Đã tiếp nhận hôm nay"
          value={incoming.filter((r) => r.status === 'ARRIVED').length}
          icon={CheckCircle2}
        />
        <StatCard label="Giường cấp cứu trống" value="4 / 12" icon={BedDouble} />
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="incoming-heading">
        <h2 id="incoming-heading" className="text-lg font-semibold">
          Ca chuyển tuyến đang tới
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {active.map((r) => (
            <IncomingReferralCard key={r.id} referral={r} />
          ))}
        </div>
      </section>
    </>
  );
}
