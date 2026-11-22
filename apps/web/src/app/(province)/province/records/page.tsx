import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, FilePlus2 } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { ReferralStatusBadge } from '@/components/shared/status-badge';
import { WireframeNote } from '@/components/shared/wireframe-note';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/format';
import { facilities, referrals } from '@/lib/mock-data';

export const metadata: Metadata = { title: 'Hồ sơ điều trị' };

export default function ContinuationRecordsPage() {
  const arrived = referrals.filter(
    (r) => r.to.id === facilities.laoCaiGeneral.id && r.status === 'ARRIVED',
  );
  return (
    <>
      <PageHeader
        title="Hồ sơ điều trị tiếp nối"
        description="Bệnh nhân đã tiếp nhận từ tuyến dưới — kế thừa toàn bộ bệnh sử, không cần hỏi lại từ đầu."
      />
      <WireframeNote task="5.1" />
      <div className="grid gap-4 md:grid-cols-2">
        {arrived.map((r) => (
          <Card key={r.id}>
            <CardHeader>
              <CardTitle>{r.patient.fullName}</CardTitle>
              <CardDescription>
                {r.diagnosis} · tiếp nhận {formatDateTime(r.createdAt)}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="text-muted-foreground flex items-center gap-2">
                {r.from.name} <ArrowRight className="size-3.5" aria-hidden /> {r.to.name}
              </div>
              <ReferralStatusBadge status={r.status} />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/province/referrals/${r.id}`}>Hồ sơ tuyến xã</Link>
                </Button>
                <Button size="sm">
                  <FilePlus2 /> Viết tiếp bệnh án
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
