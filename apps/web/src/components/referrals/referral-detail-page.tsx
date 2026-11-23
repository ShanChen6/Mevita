import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Phone,
  Smartphone,
  Stethoscope,
  Truck,
  UserRound,
} from 'lucide-react';

import { ClinicalImageGallery } from '@/components/patient/clinical-image-gallery';
import { PageHeader } from '@/components/shared/page-header';
import { PriorityBadge, ReferralStatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSession } from '@/lib/auth/session';
import {
  findReferralTrack,
  getDestinations,
  getReferral,
  getReferralVitals,
} from '@/lib/data/referrals';
import type { Referral } from '@/lib/data/types';
import { ageAt, formatDateTime, formatDecimal } from '@/lib/format';
import { bloodType, encounterType, gender } from '@/lib/labels';
import { CancelReferralButton } from './cancel-referral-button';
import { EtaCountdown } from './eta-countdown';
import { LiveVitalsPanel } from './live-vitals-panel';
import { VehicleTrackingPanel } from './vehicle-tracking-panel';
import { ReferralResponse } from './referral-response';
import { ReferralLiveRefresh } from './referral-live-refresh';

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs font-medium uppercase">{label}</span>
      <div className="whitespace-pre-line text-sm">{children}</div>
    </div>
  );
}

function Vitals({ r }: { r: Referral['sourceRecord'] }) {
  const items = [
    ['Mạch', r.pulse != null && `${r.pulse} l/p`],
    ['Huyết áp', r.systolicBp != null && `${r.systolicBp}/${r.diastolicBp} mmHg`],
    ['Nhiệt độ', r.temperature != null && `${formatDecimal(r.temperature)}°C`],
    ['Nhịp thở', r.respiratoryRate != null && `${r.respiratoryRate} l/p`],
    ['SpO2', r.spo2 != null && `${r.spo2}%`],
  ].filter((x): x is [string, string] => typeof x[1] === 'string');
  if (items.length === 0)
    return <p className="text-muted-foreground text-sm">Chưa đo sinh tồn tại tuyến dưới.</p>;
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {items.map(([k, v]) => (
        <div key={k} className="bg-muted rounded-md px-3 py-2">
          <dt className="text-muted-foreground text-xs">{k}</dt>
          <dd className="font-semibold tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

async function Detail({
  params,
  portal,
}: {
  params: Promise<{ id: string }>;
  portal: 'commune' | 'province';
}) {
  await connection();
  const { id } = await params;
  const [r, vitals, session, track] = await Promise.all([
    getReferral(id),
    getReferralVitals(id),
    getSession(),
    findReferralTrack(id),
  ]);
  const viewerFacility = session?.facilityId;
  const canRespond = r.toFacility.id === viewerFacility || session?.role === 'ADMIN';
  // Ca thường đang chờ: danh sách cơ sở để đề nghị chuyển (Task B)
  const redirectOptions =
    canRespond && r.status === 'PENDING' && r.priority === 'ROUTINE' && session?.role !== 'ADMIN'
      ? (await getDestinations('ROUTINE', r.requiredSpecialty?.code)).map((d) => ({
          id: d.id,
          name: d.name,
          note: d.reasons.slice(0, 2).join(', ') || d.commune.province.fullName,
        }))
      : [];
  const p = r.patient;
  const now = new Date().toISOString();
  const src = r.sourceRecord;
  const active = r.status === 'PENDING' || r.status === 'ACCEPTED';
  const phone = (f: Referral['fromFacility']) => f.emergencyPhone ?? f.phone;

  return (
    <>
      <PageHeader
        title={`${p.fullName} · ${gender[p.gender]}, ${ageAt(p.dateOfBirth, now)} tuổi`}
        description={`${r.code} · gửi lúc ${formatDateTime(r.createdAt)} · ${r.fromFacility.name} → ${r.toFacility.name}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={r.priority} />
            <ReferralStatusBadge status={r.status} />
            {active && r.estimatedArrivalAt && (
              <span className="rounded-md border px-2 py-1">
                <EtaCountdown until={r.estimatedArrivalAt} />
              </span>
            )}
            <Button variant="ghost" asChild>
              <Link href={`/${portal}/referrals`}>
                <ArrowLeft /> Danh sách
              </Link>
            </Button>
          </div>
        }
      />
      <ReferralLiveRefresh />

      {(p.allergies || p.chronicConditions) && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-500/10 dark:text-red-200"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {p.allergies && (
              <>
                <span className="font-semibold">Dị ứng:</span> {p.allergies}.{' '}
              </>
            )}
            {p.chronicConditions && <>Tiền sử: {p.chronicConditions}. </>}
            Nhóm máu {bloodType[p.bloodType]}
          </span>
        </div>
      )}
      {r.status === 'CANCELLED' && (
        <p className="bg-muted rounded-lg border p-3 text-sm">
          Lệnh đã huỷ lúc {r.cancelledAt && formatDateTime(r.cancelledAt)} — {r.cancellationReason}
        </p>
      )}

      <ReferralResponse
        referral={r}
        portal={portal}
        canRespond={canRespond}
        redirectOptions={redirectOptions}
      />

      {(r.transportMode || track.length > 0) && (
        <VehicleTrackingPanel referral={r} initialTrack={track} now={now} />
      )}

      <LiveVitalsPanel referralId={r.id} initial={vitals} escort={r.escort?.name ?? null} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Thông tin chuyên môn</CardTitle>
            <CardDescription>
              Phiếu khám {src.code} · {encounterType[src.encounterType]} ·{' '}
              {formatDateTime(src.visitAt)}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Info label="Lý do chuyển tuyến">{r.reason}</Info>
            {src.diagnoses.length > 0 && (
              <Info label="Chẩn đoán">
                <ul className="flex flex-col gap-0.5">
                  {src.diagnoses.map((d) => (
                    <li key={d.icdCode}>
                      <span className="font-mono text-xs font-semibold">{d.icdCode}</span> {d.name}
                      {d.isPrimary && <span className="text-muted-foreground"> (chính)</span>}
                    </li>
                  ))}
                </ul>
              </Info>
            )}
            <Info label="Sinh tồn lúc khám">
              <Vitals r={src} />
            </Info>
            <Info label="Tóm tắt bệnh án">{r.clinicalSummary}</Info>
            {r.initialTreatment && <Info label="Xử trí sơ cứu ban đầu">{r.initialTreatment}</Info>}
            {src.prescriptionItems.length > 0 && (
              <Info label="Thuốc đã dùng tại tuyến dưới">
                <ul className="list-disc pl-5">
                  {src.prescriptionItems.map((d, i) => (
                    <li key={i}>
                      {d.drugName} {d.strength} — {d.quantity} {d.unit}: {d.instructions}
                    </li>
                  ))}
                </ul>
              </Info>
            )}
            {r.sourceImages && r.sourceImages.length > 0 && (
              <Info label={`Ảnh cận lâm sàng (${r.sourceImages.length})`}>
                <ClinicalImageGallery images={r.sourceImages} />
              </Info>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Liên lạc</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p className="flex items-start gap-2">
                <Building2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  <span className="font-medium">{r.fromFacility.name}</span>
                  <span className="text-muted-foreground block">
                    {r.fromFacility.commune.province.fullName}
                  </span>
                  {phone(r.fromFacility) && (
                    <a className="text-primary block" href={`tel:${phone(r.fromFacility)}`}>
                      {phone(r.fromFacility)}
                    </a>
                  )}
                </span>
              </p>
              <p className="flex items-start gap-2">
                <Stethoscope className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  Bác sĩ chuyển: <span className="font-medium">{r.referredBy.name}</span>
                  {r.referredBy.phone && (
                    <a className="text-primary block" href={`tel:${r.referredBy.phone}`}>
                      {r.referredBy.phone}
                    </a>
                  )}
                </span>
              </p>
              <p className="flex items-start gap-2">
                <Truck className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {r.vehicle
                    ? `Xe ${r.vehicle.plateNumber} (${r.vehicle.facility.name})`
                    : (r.vehicleInfo ?? 'Chưa ghi phương tiện')}
                  {r.escort && (
                    <span className="block">
                      Đi kèm: <span className="font-medium">{r.escort.name}</span>
                      {r.escort.phone && (
                        <a className="text-primary ml-1" href={`tel:${r.escort.phone}`}>
                          {r.escort.phone}
                        </a>
                      )}
                    </span>
                  )}
                </span>
              </p>
              {p.emergencyContactPhone && (
                <p className="flex items-start gap-2">
                  <UserRound className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    Người nhà: {p.emergencyContactName ?? '—'}
                    <a className="text-primary block" href={`tel:${p.emergencyContactPhone}`}>
                      {p.emergencyContactPhone}
                    </a>
                  </span>
                </p>
              )}
              {r.fromFacility.id === viewerFacility && phone(r.toFacility) && (
                <p className="flex items-start gap-2">
                  <Phone className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    Đường dây nóng {r.toFacility.name}
                    <a className="text-primary block" href={`tel:${phone(r.toFacility)}`}>
                      {phone(r.toFacility)}
                    </a>
                  </span>
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Tiến trình</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p>Gửi lệnh: {formatDateTime(r.createdAt)}</p>
              {r.estimatedArrivalAt && <p>Dự kiến tới: {formatDateTime(r.estimatedArrivalAt)}</p>}
              {r.acceptedAt && (
                <p>
                  Tiếp nhận: {formatDateTime(r.acceptedAt)}{' '}
                  {r.acceptedBy && `· ${r.acceptedBy.name}`}
                </p>
              )}
              {r.arrivedAt && <p>Đã tới: {formatDateTime(r.arrivedAt)}</p>}
              {active && r.fromFacility.id === viewerFacility && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" asChild>
                    <Link href={`/escort/${r.id}`}>
                      <Smartphone /> Màn hình trên xe
                    </Link>
                  </Button>
                  <CancelReferralButton id={r.id} code={r.code} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

export function ReferralDetailPage({
  params,
  portal,
}: {
  params: Promise<{ id: string }>;
  portal: 'commune' | 'province';
}) {
  return (
    <Suspense
      fallback={<div className="bg-muted/50 h-[70svh] animate-pulse rounded-xl border" aria-busy />}
    >
      <Detail params={params} portal={portal} />
    </Suspense>
  );
}
