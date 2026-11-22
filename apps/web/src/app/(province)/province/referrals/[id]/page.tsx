import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AlertTriangle, CheckCheck, ImageIcon, LogIn, Truck, UserRound, X } from 'lucide-react';

import { EtaCountdown } from '@/components/referrals/eta-countdown';
import { VitalsChart } from '@/components/referrals/vitals-chart';
import { Field } from '@/components/shared/field';
import { PageHeader } from '@/components/shared/page-header';
import { PriorityBadge, ReferralStatusBadge } from '@/components/shared/status-badge';
import { WireframeNote } from '@/components/shared/wireframe-note';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ageAt, formatDateTime, formatTime } from '@/lib/format';
import { consciousnessLevel } from '@/lib/labels';
import { findReferral, MOCK_NOW, referrals } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Chi tiết ca chuyển tuyến' };

export function generateStaticParams() {
  return referrals.map((r) => ({ id: r.id }));
}

export default async function ReferralDetailPage({
  params,
}: PageProps<'/province/referrals/[id]'>) {
  const { id } = await params;
  const r = findReferral(id);
  if (!r) notFound();
  const p = r.patient;

  return (
    <>
      <PageHeader
        title={`${p.fullName} · ${p.gender}, ${ageAt(p.dateOfBirth, MOCK_NOW)} tuổi`}
        description={`${r.code} · gửi lúc ${formatDateTime(r.createdAt)} · ${r.from.name}, ${r.from.provinceName}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={r.priority} />
            <ReferralStatusBadge status={r.status} />
            {r.status !== 'ARRIVED' && (
              <span className="rounded-md border px-2 py-1">
                <EtaCountdown minutes={r.etaMinutes} />
              </span>
            )}
          </div>
        }
      />
      <WireframeNote task="4.4, 5.1">
        biểu đồ cập nhật theo sự kiện vital_update qua Socket.io
      </WireframeNote>

      {p.allergies.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-500/10 dark:text-red-200">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <span>
            <span className="font-semibold">Dị ứng:</span> {p.allergies.join(', ')} · Nhóm máu{' '}
            {p.bloodType}
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Diễn biến sinh tồn trên xe</CardTitle>
            <CardDescription>
              {r.vehicleInfo} · {r.escortName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VitalsChart data={r.vitals} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Phản hồi tuyến dưới</CardTitle>
            <CardDescription>Tuyến xã nhận được xác nhận ngay lập tức.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Field label="Ghi chú chuẩn bị" htmlFor="prep">
              <Textarea
                id="prep"
                rows={4}
                defaultValue={r.preparationNote}
                placeholder="VD: Đã chuẩn bị phòng mổ số 2, dự trù 2 đơn vị máu O"
              />
            </Field>
            {r.status === 'PENDING' && (
              <>
                <Button className="h-auto whitespace-normal py-2">
                  <CheckCheck /> Xác nhận tiếp nhận & sẵn sàng ê-kíp
                </Button>
                <Button variant="outline">
                  <X /> Không thể tiếp nhận
                </Button>
              </>
            )}
            {r.status === 'ACCEPTED' && (
              <Button className="h-auto whitespace-normal py-2">
                <LogIn /> Xe đã tới — tiếp nhận bệnh nhân
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hồ sơ từ tuyến xã</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p>
              <span className="text-muted-foreground">Chẩn đoán: </span>
              <span className="font-medium">{r.diagnosis}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Lý do chuyển: </span>
              {r.reason}
            </p>
            <p>
              <span className="text-muted-foreground">Tóm tắt bệnh án: </span>
              {r.clinicalSummary}
            </p>
            <p>
              <span className="text-muted-foreground">Xử trí sơ cứu: </span>
              {r.initialTreatment}
            </p>
            <p className="text-muted-foreground flex items-center gap-1.5">
              <UserRound className="size-3.5" aria-hidden /> Bác sĩ chuyển: {r.referredBy}
            </p>
            <div className="flex gap-2">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="bg-muted text-muted-foreground flex size-20 items-center justify-center rounded-md border"
                  title="Ảnh cận lâm sàng"
                >
                  <ImageIcon className="size-5" aria-hidden />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="py-2">
          <CardHeader className="pt-4">
            <CardTitle className="flex items-center gap-2">
              <Truck className="size-4" aria-hidden /> Nhật ký sinh tồn
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Giờ</TableHead>
                  <TableHead>Mạch</TableHead>
                  <TableHead>HA</TableHead>
                  <TableHead>SpO2</TableHead>
                  <TableHead>GCS</TableHead>
                  <TableHead>Tri giác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...r.vitals].reverse().map((v) => (
                  <TableRow key={v.recordedAt} className="tabular-nums">
                    <TableCell>{formatTime(v.recordedAt)}</TableCell>
                    <TableCell>{v.pulse}</TableCell>
                    <TableCell>
                      {v.systolicBp}/{v.diastolicBp}
                    </TableCell>
                    <TableCell
                      className={cn(v.spo2 < 94 && 'font-semibold text-red-600 dark:text-red-400')}
                    >
                      {v.spo2}%
                    </TableCell>
                    <TableCell>{v.gcs}</TableCell>
                    <TableCell className="text-xs">{consciousnessLevel[v.consciousness]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
