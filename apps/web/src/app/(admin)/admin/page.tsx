import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { Ambulance, CalendarCheck, Clock, Percent, Stethoscope, Truck } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { APPOINTMENT_GROUPS, toAppointmentRows } from '@/components/stats/appointment-groups';
import { AppointmentsChart } from '@/components/stats/appointments-chart';
import { BarList } from '@/components/stats/bar-list';
import { bucketTitle } from '@/components/stats/bucket';
import { DiseaseHeatmap } from '@/components/stats/disease-heatmap';
import { ReferralsTrend } from '@/components/stats/referrals-trend';
import { StatsFilters } from '@/components/stats/stats-filters';
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
import { getStatsOverview, getStatsProvinces } from '@/lib/data/admin';
import { addDaysStr, formatDate, vnDate } from '@/lib/format';
import { referralPriority } from '@/lib/labels';

export const metadata: Metadata = { title: 'Thống kê' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const str = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);
const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const fmt = (n: number | null, suffix = '') =>
  n == null ? '—' : `${n.toLocaleString('vi-VN')}${suffix}`;

async function Dashboard({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const sp = await searchParams;
  const today = vnDate();
  const custom = isDate(str(sp.from)) && isDate(str(sp.to));
  const days = Number(str(sp.days)) || 90;
  const from = custom ? str(sp.from)! : addDaysStr(today, -(days - 1));
  const to = custom ? str(sp.to)! : today;
  const province = str(sp.province) ?? '';
  const [o, provinces] = await Promise.all([
    getStatsOverview(from, to, province || undefined),
    getStatsProvinces(),
  ]);
  const k = o.kpis;
  const unitLabel = { day: 'ngày', week: 'tuần', month: 'tháng' }[o.range.unit];
  const apptRows = toAppointmentRows(o.appointmentsTrend);
  const provinceName = provinces.find((p) => p.code === province)?.name;

  return (
    <>
      <StatsFilters
        provinces={provinces}
        from={from}
        to={to}
        province={province}
        preset={custom ? null : days}
      />
      <p className="text-muted-foreground -mt-2 text-sm">
        {formatDate(`${from}T00:00:00+07:00`)} – {formatDate(`${to}T00:00:00+07:00`)} ·{' '}
        {provinceName ?? 'Toàn quốc'} · địa phương tính theo nơi đặt cơ sở y tế
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Lượt đặt lịch"
          value={fmt(k.appointments)}
          hint={`Huỷ ${fmt(k.cancelRate, '%')} · không đến ${fmt(k.noShowRate, '%')}`}
          icon={CalendarCheck}
        />
        <StatCard
          label="Lượt khám đã ký"
          value={fmt(k.visits)}
          hint={`Tại trạm y tế xã: ${fmt(k.communeVisits)}`}
          icon={Stethoscope}
        />
        <StatCard
          label="Phiếu chuyển tuyến"
          value={fmt(k.referrals)}
          hint={`Liên tỉnh: ${fmt(k.interProvincial)}`}
          icon={Ambulance}
        />
        <StatCard
          label="Tỉ lệ chuyển tuyến xã → trên"
          value={fmt(k.communeReferralRate, '%')}
          hint="Phiếu chuyển đi / lượt khám tại trạm"
          icon={Percent}
        />
        <StatCard
          label="Phản hồi của tuyến trên"
          value={fmt(k.medianAcceptMinutes, ' phút')}
          hint="Trung vị từ lúc gửi đến khi xác nhận"
          icon={Clock}
        />
        <StatCard
          label="Thời gian vận chuyển"
          value={fmt(k.medianTransportMinutes, ' phút')}
          hint="Trung vị từ lúc xe đi đến khi tới"
          icon={Truck}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lượt đặt lịch khám theo {unitLabel}</CardTitle>
          <CardDescription>
            {fmt(k.appointments)} lượt · đã khám {fmt(k.appointmentsCompleted)}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {apptRows.length > 0 ? (
            <AppointmentsChart rows={apptRows} unit={o.range.unit} />
          ) : (
            <p className="text-muted-foreground text-sm">
              Chưa có lịch hẹn trong khoảng thời gian này.
            </p>
          )}
          {apptRows.length > 0 && (
            <details className="text-sm">
              <summary className="text-primary cursor-pointer">Xem dạng bảng</summary>
              <div className="mt-2 max-h-72 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kỳ</TableHead>
                      {APPOINTMENT_GROUPS.map((g) => (
                        <TableHead key={g.key} className="text-right">
                          {g.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apptRows.map((r) => (
                      <TableRow key={r.bucket}>
                        <TableCell>{bucketTitle(r.bucket, o.range.unit)}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.done}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.waiting}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.missed}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tỉ lệ chuyển tuyến từ trạm y tế xã</CardTitle>
            <CardDescription>
              {province ? 'Theo từng trạm (cao nhất trước)' : 'Theo tỉnh/thành'} · phiếu chuyển đi /
              lượt khám đã ký
            </CardDescription>
          </CardHeader>
          <CardContent>
            {province ? (
              <BarList
                ariaLabel="Tỉ lệ chuyển tuyến theo trạm"
                items={o.stations.slice(0, 12).map((s) => ({
                  key: s.id,
                  label: s.name,
                  value: s.rate ?? 0,
                  display: fmt(s.rate, '%'),
                  title: `${s.name}: ${s.referrals}/${s.visits} lượt khám`,
                }))}
              />
            ) : (
              <BarList
                ariaLabel="Tỉ lệ chuyển tuyến theo tỉnh"
                items={[...o.provinces]
                  .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))
                  .map((p) => ({
                    key: p.code,
                    label: p.name,
                    value: p.rate ?? 0,
                    display: fmt(p.rate, '%'),
                    title: `${p.name}: ${p.referrals.toLocaleString('vi-VN')} phiếu / ${p.visits.toLocaleString('vi-VN')} lượt khám`,
                  }))}
              />
            )}
            {o.provinces.length === 0 && (
              <p className="text-muted-foreground text-sm">Chưa có lượt khám tại trạm y tế xã.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Phiếu chuyển tuyến theo {unitLabel}</CardTitle>
            <CardDescription>
              Đã tới {fmt(k.arrived)} · từ chối {fmt(k.rejected)} · huỷ {fmt(k.cancelled)} · đang xử
              lý {fmt(k.active)}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {o.referralsTrend.length > 0 ? (
              <ReferralsTrend rows={o.referralsTrend} unit={o.range.unit} />
            ) : (
              <p className="text-muted-foreground text-sm">Chưa có phiếu chuyển tuyến.</p>
            )}
            <div className="flex flex-wrap gap-2 text-sm">
              {o.referralPriority.map((p) => (
                <span
                  key={p.priority}
                  className="flex items-center gap-1.5 rounded-md border px-2 py-1"
                >
                  <Badge className={referralPriority[p.priority].className + ' border-transparent'}>
                    {referralPriority[p.priority].label}
                  </Badge>
                  <span className="font-medium tabular-nums">{p.n.toLocaleString('vi-VN')}</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mô hình bệnh tật theo địa phương</CardTitle>
          <CardDescription>
            Tỉ trọng chẩn đoán chính theo chương ICD-10 trong tổng lượt khám của mỗi tỉnh (8 nhóm
            bệnh nhiều nhất)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DiseaseHeatmap data={o.diseasePattern} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>10 bệnh thường gặp nhất</CardTitle>
            <CardDescription>Theo chẩn đoán chính (ICD-10)</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList
              ariaLabel="Bệnh thường gặp"
              items={o.topDiagnoses.map((d) => ({
                key: d.code,
                label: (
                  <>
                    <span className="font-mono text-xs font-semibold">{d.code}</span> {d.name}
                  </>
                ),
                value: d.n,
                title: `${d.code} ${d.name}: ${d.n.toLocaleString('vi-VN')} lượt`,
              }))}
            />
            {o.topDiagnoses.length === 0 && (
              <p className="text-muted-foreground text-sm">Chưa có chẩn đoán.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Luồng chuyển tuyến</CardTitle>
            <CardDescription>Tỉnh nơi chuyển đi → tỉnh nơi tiếp nhận</CardDescription>
          </CardHeader>
          <CardContent className="max-h-96 overflow-auto px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Từ</TableHead>
                  <TableHead>Đến</TableHead>
                  <TableHead className="text-right">Phiếu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {o.flows.map((f) => (
                  <TableRow key={`${f.fromName}-${f.toName}`}>
                    <TableCell>{f.fromName}</TableCell>
                    <TableCell>
                      {f.toName}{' '}
                      {f.inter && (
                        <Badge variant="outline" className="ml-1">
                          Liên tỉnh
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {f.n.toLocaleString('vi-VN')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="py-2">
        <CardHeader className="pt-4">
          <CardTitle>Chi tiết theo trạm y tế xã</CardTitle>
        </CardHeader>
        <CardContent className="max-h-[28rem] overflow-auto px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trạm y tế</TableHead>
                <TableHead>Tỉnh / thành</TableHead>
                <TableHead className="text-right">Lượt khám</TableHead>
                <TableHead className="text-right">Chuyển tuyến</TableHead>
                <TableHead className="text-right">Tỉ lệ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {o.stations.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.province}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.visits.toLocaleString('vi-VN')}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.referrals.toLocaleString('vi-VN')}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(s.rate, '%')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

export default function StatsPage({ searchParams }: PageProps<'/admin'>) {
  return (
    <>
      <PageHeader
        title="Thống kê hệ thống"
        description="Dành cho quản trị viên / Sở Y tế: đặt lịch khám, chuyển tuyến và mô hình bệnh tật."
      />
      <Suspense
        fallback={
          <div className="bg-muted/50 h-[80svh] animate-pulse rounded-xl border" aria-busy />
        }
      >
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </>
  );
}
