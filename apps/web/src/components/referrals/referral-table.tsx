import Link from 'next/link';
import { Smartphone } from 'lucide-react';

import { PriorityBadge, ReferralStatusBadge } from '@/components/shared/status-badge';
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
import type { Referral } from '@/lib/data/types';
import { formatDateTime } from '@/lib/format';
import { CancelReferralButton } from './cancel-referral-button';

/** Bảng phiếu chuyển tuyến — `outgoing`: cơ sở mình gửi đi (huỷ được); `incoming`: gửi tới cơ sở mình. */
export function ReferralTable({
  rows,
  direction,
  portal,
}: {
  rows: Referral[];
  direction: 'incoming' | 'outgoing';
  portal: 'commune' | 'province';
}) {
  if (rows.length === 0)
    return (
      <Card className="text-muted-foreground px-6 py-10 text-center text-sm">
        {direction === 'outgoing'
          ? 'Chưa gửi lệnh chuyển tuyến nào.'
          : 'Chưa có ca chuyển tuyến nào gửi tới.'}
      </Card>
    );
  return (
    <Card className="py-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Mã phiếu</TableHead>
            <TableHead>Bệnh nhân</TableHead>
            <TableHead>Mức độ</TableHead>
            <TableHead>{direction === 'outgoing' ? 'Nơi nhận' : 'Nơi gửi'}</TableHead>
            <TableHead>Gửi lúc</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead className="pr-4" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const other = direction === 'outgoing' ? r.toFacility : r.fromFacility;
            const active = r.status === 'PENDING' || r.status === 'ACCEPTED';
            return (
              <TableRow key={r.id} data-testid={`referral-${r.code}`}>
                <TableCell className="pl-4 font-mono text-xs">{r.code}</TableCell>
                <TableCell className="font-medium">{r.patient.fullName}</TableCell>
                <TableCell>
                  <PriorityBadge priority={r.priority} />
                </TableCell>
                <TableCell>
                  {other.name}
                  {r.interProvincial && (
                    <span className="text-muted-foreground block text-xs">
                      {other.commune.province.fullName}
                    </span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{formatDateTime(r.createdAt)}</TableCell>
                <TableCell>
                  <ReferralStatusBadge status={r.status} />
                  {r.status === 'CANCELLED' && r.cancellationReason && (
                    <span className="text-muted-foreground block max-w-48 truncate text-xs">
                      {r.cancellationReason}
                    </span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap pr-4 text-right">
                  {direction === 'outgoing' && active && (
                    <>
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/escort/${r.id}`}>
                          <Smartphone /> Trên xe
                        </Link>
                      </Button>
                      <CancelReferralButton id={r.id} code={r.code} />
                    </>
                  )}
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/${portal}/referrals/${r.id}`}>Chi tiết</Link>
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
