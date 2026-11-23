import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowRight } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { PriorityBadge } from '@/components/shared/status-badge';
import { ReferralLiveRefresh } from '@/components/referrals/referral-live-refresh';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { listReferrals } from '@/lib/data/referrals';
import { formatDateTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Hồ sơ điều trị' };

async function List() {
  const arrived = await listReferrals('incoming', false, 'ARRIVED');
  if (arrived.length === 0)
    return (
      <Card className="text-muted-foreground px-6 py-10 text-center text-sm">
        Chưa có bệnh nhân nào được tiếp nhận từ tuyến dưới. Khi xe tới, bấm “Xe đã tới — Tiếp nhận
        bệnh nhân” trên phiếu chuyển tuyến để mở hồ sơ điều trị tiếp nối.
      </Card>
    );
  return (
    <Card className="py-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Bệnh nhân</TableHead>
            <TableHead>Chuyển từ</TableHead>
            <TableHead>Tiếp nhận</TableHead>
            <TableHead>Hồ sơ</TableHead>
            <TableHead className="pr-4" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {arrived.map((r) => (
            <TableRow key={r.id} data-testid={`continuation-${r.code}`}>
              <TableCell className="pl-4">
                <span className="font-medium">{r.patient.fullName}</span>
                <span className="mt-1 block">
                  <PriorityBadge priority={r.priority} />
                </span>
              </TableCell>
              <TableCell>
                {r.fromFacility.name}
                <span className="text-muted-foreground block font-mono text-xs">{r.code}</span>
              </TableCell>
              <TableCell className="tabular-nums">
                {r.arrivedAt && formatDateTime(r.arrivedAt)}
                {r.receivedBy && (
                  <span className="text-muted-foreground block text-xs">{r.receivedBy.name}</span>
                )}
              </TableCell>
              <TableCell>
                {r.continuationRecord ? (
                  <>
                    <span className="font-mono text-xs">{r.continuationRecord.code}</span>{' '}
                    <Badge
                      variant={
                        r.continuationRecord.status === 'FINALIZED' ? 'secondary' : 'outline'
                      }
                    >
                      {r.continuationRecord.status === 'FINALIZED' ? 'Đã ký' : 'Đang điều trị'}
                    </Badge>
                  </>
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell className="pr-4 text-right">
                {r.continuationRecord && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/province/encounters/${r.continuationRecord.id}`}>
                      Mở hồ sơ <ArrowRight />
                    </Link>
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export default function ContinuationRecordsPage() {
  return (
    <>
      <PageHeader
        title="Hồ sơ điều trị tiếp nối"
        description="Bệnh nhân đã tiếp nhận từ tuyến dưới — kế thừa toàn bộ bệnh sử, không cần hỏi lại từ đầu."
      />
      <ReferralLiveRefresh />
      <Suspense
        fallback={<div className="bg-muted/50 h-64 animate-pulse rounded-xl border" aria-busy />}
      >
        <List />
      </Suspense>
    </>
  );
}
