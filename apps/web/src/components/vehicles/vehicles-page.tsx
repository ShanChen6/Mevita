import Link from 'next/link';
import { Suspense } from 'react';

import { ReferralLiveRefresh } from '@/components/referrals/referral-live-refresh';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getVehicles } from '@/lib/data/referrals';
import { formatDateTime } from '@/lib/format';
import { vehicleStatus, vehicleType } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { VehicleForm } from './vehicle-form';
import { VehicleStatusToggle } from './vehicle-status-toggle';

async function List({ portal }: { portal: 'commune' | 'province' }) {
  const vehicles = await getVehicles();
  if (vehicles.length === 0)
    return (
      <Card className="text-muted-foreground px-6 py-8 text-center text-sm">
        Cơ sở chưa khai báo xe. Ca cấp cứu sẽ được gợi ý yêu cầu xe đón từ cơ sở có xe gần nhất.
      </Card>
    );
  return (
    <Card className="py-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Biển số</TableHead>
            <TableHead>Loại · trang bị</TableHead>
            <TableHead>Tài xế</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead>Vị trí gần nhất</TableHead>
            <TableHead className="pr-4" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {vehicles.map((v) => (
            <TableRow
              key={v.id}
              data-testid={`vehicle-${v.plateNumber}`}
              className={cn(!v.isActive && 'opacity-50')}
            >
              <TableCell className="pl-4 font-mono font-medium">{v.plateNumber}</TableCell>
              <TableCell>
                {vehicleType[v.type]}
                {v.equipment && (
                  <span className="text-muted-foreground block text-xs">{v.equipment}</span>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {v.driverName ?? '—'}
                {v.driverPhone && (
                  <span className="text-muted-foreground block text-xs">{v.driverPhone}</span>
                )}
              </TableCell>
              <TableCell>
                <Badge className={cn('border-transparent', vehicleStatus[v.status].className)}>
                  {vehicleStatus[v.status].label}
                </Badge>
                {v.mission && (
                  <Link
                    className="text-primary block text-xs"
                    href={`/${portal}/referrals/${v.mission.id}`}
                  >
                    {v.mission.code}: {v.mission.fromFacility.name} → {v.mission.toFacility.name}
                  </Link>
                )}
              </TableCell>
              <TableCell className="text-sm tabular-nums">
                {v.lastSeenAt ? formatDateTime(v.lastSeenAt) : '—'}
              </TableCell>
              <TableCell className="pr-4 text-right">
                <VehicleStatusToggle id={v.id} status={v.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export function VehiclesPage({ portal }: { portal: 'commune' | 'province' }) {
  return (
    <>
      <PageHeader
        title="Xe chuyển viện"
        description="Xe của cơ sở dùng cho lệnh chuyển tuyến và yêu cầu xe đón. Xe đang làm nhiệm vụ tự trở về Sẵn sàng khi ca kết thúc."
      />
      <ReferralLiveRefresh />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thêm xe</CardTitle>
        </CardHeader>
        <CardContent>
          <VehicleForm />
        </CardContent>
      </Card>
      <Suspense
        fallback={<div className="bg-muted/50 h-48 animate-pulse rounded-xl border" aria-busy />}
      >
        <List portal={portal} />
      </Suspense>
    </>
  );
}
