import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { AlertTriangle, Phone } from 'lucide-react';

import { CoordinationLive } from '@/components/coordination/coordination-live';
import { VehicleMapLazy } from '@/components/referrals/vehicle-map-lazy';
import { PageHeader } from '@/components/shared/page-header';
import { PriorityBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getCoordinationOverview } from '@/lib/data/referrals';
import { formatDateTime, formatTime } from '@/lib/format';
import { loadLevel, vehicleType } from '@/lib/labels';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Điều phối' };

const LOAD_COLOR = {
  GREEN: '#0ca30c',
  YELLOW: '#eda100',
  RED: '#d03b3b',
  UNKNOWN: '#898781',
} as const;

async function Overview() {
  await connection();
  const o = await getCoordinationOverview();
  const places = [
    ...o.hospitals
      .filter((h) => h.latitude != null && h.longitude != null)
      .map((h) => ({
        label: `${h.name} · ${loadLevel[h.load].label}${h.erBedsAvailable != null ? ` · ${h.erBedsAvailable} giường` : ''}`,
        latitude: h.latitude!,
        longitude: h.longitude!,
        kind: 'to' as const,
        color: LOAD_COLOR[h.load],
        permanent: false,
      })),
    ...o.vehicles
      .filter((v) => v.lastLatitude != null && v.lastLongitude != null)
      .map((v) => ({
        label: `Xe ${v.plateNumber}${v.mission ? ` · ${v.mission.code} → ${v.mission.toFacility.name}` : ''}`,
        latitude: v.lastLatitude!,
        longitude: v.lastLongitude!,
        kind: 'vehicle' as const,
      })),
  ];
  return (
    <>
      <Card
        className={cn(
          o.waiting.some((w) => w.escalationLevel > 0) && 'border-red-300 dark:border-red-500/40',
        )}
        data-testid="waiting-card"
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-red-600" aria-hidden /> Ca cấp cứu chờ bệnh viện
            phản hồi ({o.waiting.length})
          </CardTitle>
          <CardDescription>
            Tối khẩn quá 3 phút / khẩn quá 10 phút: hệ thống tự nhắc kíp trực; quá gấp đôi: báo điều
            phối.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2">
          {o.waiting.length === 0 ? (
            <p className="text-muted-foreground px-4 text-sm">Không có ca nào đang chờ.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ca</TableHead>
                  <TableHead>Chờ</TableHead>
                  <TableHead>Từ → tới</TableHead>
                  <TableHead>Liên hệ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {o.waiting.map((w) => (
                  <TableRow key={w.id} data-testid={`waiting-${w.code}`}>
                    <TableCell>
                      <span className="font-mono text-xs">{w.code}</span>
                      <span className="mt-1 block">
                        <PriorityBadge priority={w.priority} />
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {w.waitedMinutes} phút
                      {w.escalationLevel > 0 && (
                        <Badge className="ml-1 border-transparent bg-red-600 text-white">
                          Leo thang mức {w.escalationLevel}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {w.fromFacility.name} →{' '}
                      <span className="font-medium">{w.toFacility.name}</span>
                      <span className="text-muted-foreground block text-xs">{w.reason}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {(w.toFacility.emergencyPhone ?? w.toFacility.phone) && (
                        <a
                          className="text-primary flex items-center gap-1"
                          href={`tel:${w.toFacility.emergencyPhone ?? w.toFacility.phone}`}
                        >
                          <Phone className="size-3" aria-hidden /> BV{' '}
                          {w.toFacility.emergencyPhone ?? w.toFacility.phone}
                        </a>
                      )}
                      {(w.fromFacility.emergencyPhone ?? w.fromFacility.phone) && (
                        <a
                          className="text-primary flex items-center gap-1"
                          href={`tel:${w.fromFacility.emergencyPhone ?? w.fromFacility.phone}`}
                        >
                          <Phone className="size-3" aria-hidden /> Tuyến dưới{' '}
                          {w.fromFacility.emergencyPhone ?? w.fromFacility.phone}
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bản đồ điều phối</CardTitle>
          <CardDescription className="flex flex-wrap gap-3">
            {(['GREEN', 'YELLOW', 'RED', 'UNKNOWN'] as const).map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: LOAD_COLOR[k] }}
                  aria-hidden
                />{' '}
                {loadLevel[k].label}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full border bg-[#2a78d6]" aria-hidden /> Xe đang làm
              nhiệm vụ
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {places.length > 0 ? (
            <VehicleMapLazy places={places} track={[]} className="h-96" />
          ) : (
            <p className="text-muted-foreground text-sm">Chưa có toạ độ cơ sở.</p>
          )}
        </CardContent>
      </Card>

      <Card className="py-2">
        <CardHeader className="pt-4">
          <CardTitle>Năng lực tiếp nhận các bệnh viện</CardTitle>
        </CardHeader>
        <CardContent className="px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bệnh viện</TableHead>
                <TableHead>Mức tải</TableHead>
                <TableHead className="text-right">Giường CC trống</TableHead>
                <TableHead className="text-right">Hồi sức</TableHead>
                <TableHead className="text-right">Ca đang tới</TableHead>
                <TableHead className="text-right">BS trực</TableHead>
                <TableHead>Cập nhật</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {o.hospitals.map((h) => (
                <TableRow key={h.id} data-testid={`hospital-${h.id}`}>
                  <TableCell>
                    <span className="font-medium">{h.name}</span>
                    <span className="text-muted-foreground block text-xs">
                      {h.province}
                      {h.capacityNote && ` · ${h.capacityNote}`}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn('border-transparent', loadLevel[h.load].className)}>
                      {loadLevel[h.load].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {h.erBedsAvailable != null ? `${h.erBedsAvailable}/${h.erBedsTotal}` : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {h.icuBedsAvailable ?? '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{h.activeIncoming}</TableCell>
                  <TableCell className="text-right tabular-nums">{h.onDutyCount}</TableCell>
                  <TableCell
                    className={cn(
                      'text-sm tabular-nums',
                      h.capacityStale && 'text-amber-700 dark:text-amber-400',
                    )}
                  >
                    {h.capacityUpdatedAt ? formatDateTime(h.capacityUpdatedAt) : 'Chưa cập nhật'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="py-2">
        <CardHeader className="pt-4">
          <CardTitle>Xe đang làm nhiệm vụ ({o.vehicles.length})</CardTitle>
        </CardHeader>
        <CardContent className="px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Xe</TableHead>
                <TableHead>Ca</TableHead>
                <TableHead>Dự kiến tới</TableHead>
                <TableHead>Vị trí cuối</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {o.vehicles.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <span className="font-mono font-medium">{v.plateNumber}</span>
                    <span className="text-muted-foreground block text-xs">
                      {vehicleType[v.type]} · {v.facility.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {v.mission ? (
                      <>
                        <PriorityBadge priority={v.mission.priority} /> {v.mission.code} →{' '}
                        {v.mission.toFacility.name}
                      </>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {v.mission?.estimatedArrivalAt ? formatTime(v.mission.estimatedArrivalAt) : '—'}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {v.lastSeenAt ? formatTime(v.lastSeenAt) : 'Chưa có'}
                  </TableCell>
                </TableRow>
              ))}
              {o.vehicles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground text-center">
                    Không có xe nào đang chạy.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

export default function CoordinationPage() {
  return (
    <>
      <PageHeader
        title="Điều phối cấp cứu"
        description="Dành cho điều phối viên Sở Y tế: ca chậm phản hồi, năng lực tiếp nhận các bệnh viện, xe đang chạy."
      />
      <CoordinationLive />
      <Suspense
        fallback={
          <div className="bg-muted/50 h-[70svh] animate-pulse rounded-xl border" aria-busy />
        }
      >
        <Overview />
      </Suspense>
    </>
  );
}
