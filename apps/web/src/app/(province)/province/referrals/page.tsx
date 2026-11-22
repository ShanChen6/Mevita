import type { Metadata } from 'next';
import Link from 'next/link';

import { PriorityBadge, ReferralStatusBadge } from '@/components/shared/status-badge';
import { PageHeader } from '@/components/shared/page-header';
import { WireframeNote } from '@/components/shared/wireframe-note';
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
import { formatDateTime } from '@/lib/format';
import { facilities, referrals } from '@/lib/mock-data';

export const metadata: Metadata = { title: 'Ca chuyển tuyến' };

export default function IncomingReferralsPage() {
  const rows = referrals.filter((r) => r.to.id === facilities.laoCaiGeneral.id);
  return (
    <>
      <PageHeader
        title="Ca chuyển tuyến"
        description="Tất cả phiếu chuyển tuyến gửi tới bệnh viện."
      />
      <WireframeNote task="4.4, 5.1" />
      <Card className="py-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Mã phiếu</TableHead>
              <TableHead>Bệnh nhân</TableHead>
              <TableHead>Mức độ</TableHead>
              <TableHead>Nơi gửi</TableHead>
              <TableHead>Gửi lúc</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="pl-4 font-mono text-xs">{r.code}</TableCell>
                <TableCell className="font-medium">{r.patient.fullName}</TableCell>
                <TableCell>
                  <PriorityBadge priority={r.priority} />
                </TableCell>
                <TableCell>{r.from.name}</TableCell>
                <TableCell className="tabular-nums">{formatDateTime(r.createdAt)}</TableCell>
                <TableCell>
                  <ReferralStatusBadge status={r.status} />
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/province/referrals/${r.id}`}>Chi tiết</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
