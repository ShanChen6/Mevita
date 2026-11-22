import type { Metadata } from 'next';
import Link from 'next/link';
import { Ambulance, Smartphone } from 'lucide-react';

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

export const metadata: Metadata = { title: 'Chuyển tuyến' };

export default function OutgoingReferralsPage() {
  const rows = referrals.filter((r) => r.from.id === facilities.muongKhuong.id);
  return (
    <>
      <PageHeader
        title="Chuyển tuyến"
        description="Các ca đã chuyển lên tuyến trên và phản hồi của bệnh viện nhận."
        actions={
          <Button variant="destructive" asChild>
            <Link href="/commune/referrals/new">
              <Ambulance /> Chuyển tuyến khẩn cấp
            </Link>
          </Button>
        }
      />
      <WireframeNote task="4.2" />
      <Card className="py-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Mã phiếu</TableHead>
              <TableHead>Bệnh nhân</TableHead>
              <TableHead>Mức độ</TableHead>
              <TableHead>Nơi nhận</TableHead>
              <TableHead>Gửi lúc</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="pr-4 text-right">Trên xe</TableHead>
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
                <TableCell>{r.to.name}</TableCell>
                <TableCell className="tabular-nums">{formatDateTime(r.createdAt)}</TableCell>
                <TableCell>
                  <ReferralStatusBadge status={r.status} />
                </TableCell>
                <TableCell className="pr-4 text-right">
                  {r.status !== 'ARRIVED' && (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/escort/${r.id}`}>
                        <Smartphone /> Màn hình xe
                      </Link>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
