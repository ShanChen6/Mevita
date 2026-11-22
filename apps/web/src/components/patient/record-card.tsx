import { Building2, CalendarClock, HeartPulse, Pill, ShieldCheck, Stethoscope } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MedicalRecordItem } from '@/lib/data/types';
import { formatDate, formatDecimal, formatTime } from '@/lib/format';
import { encounterType } from '@/lib/labels';
import { ClinicalImageGallery } from './clinical-image-gallery';

export function doctorName(d: MedicalRecordItem['doctor']) {
  return d.academicTitle ? `${d.academicTitle}. ${d.fullName}` : d.fullName;
}

function Vitals({ r }: { r: MedicalRecordItem }) {
  const parts = [
    r.pulse != null && `Mạch ${r.pulse}`,
    r.systolicBp != null && r.diastolicBp != null && `HA ${r.systolicBp}/${r.diastolicBp}`,
    r.temperature != null && `${formatDecimal(r.temperature)}°C`,
    r.respiratoryRate != null && `Nhịp thở ${r.respiratoryRate}`,
    r.spo2 != null && `SpO2 ${r.spo2}%`,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-center gap-1 font-medium">
        <HeartPulse className="size-3.5" aria-hidden /> Sinh tồn
      </p>
      <p className="text-muted-foreground tabular-nums">{parts.join(' · ')}</p>
    </div>
  );
}

/** Một lần khám trong lịch sử. Dùng được ở cả server và client component. */
export function RecordCard({ record: r }: { record: MedicalRecordItem }) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-primary font-medium tabular-nums">
            {formatTime(r.visitAt)} · {formatDate(r.visitAt)}
          </span>
          {r.encounterType !== 'OUTPATIENT' && (
            <Badge variant="outline">{encounterType[r.encounterType]}</Badge>
          )}
        </div>
        <CardTitle className="text-lg">{r.chiefComplaint}</CardTitle>
        <div className="text-muted-foreground flex flex-col gap-1 text-sm sm:flex-row sm:flex-wrap sm:gap-x-4">
          <span className="flex items-center gap-1.5">
            <Stethoscope className="size-3.5 shrink-0" aria-hidden />
            {doctorName(r.doctor)}
            {r.specialty && ` · ${r.specialty.name}`}
          </span>
          <span className="flex items-center gap-1.5">
            <Building2 className="size-3.5 shrink-0" aria-hidden />
            {r.facility.name}
          </span>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="font-medium">Chẩn đoán (ICD-10)</p>
          <ul className="flex flex-col gap-1.5">
            {r.diagnoses.map((d) => (
              <li key={d.icdCode} className="flex items-start gap-2">
                <Badge variant={d.isPrimary ? 'default' : 'outline'} className="font-mono">
                  {d.icdCode}
                </Badge>
                <span>
                  {d.name}
                  {d.isPrimary && <span className="text-muted-foreground"> · bệnh chính</span>}
                </span>
              </li>
            ))}
          </ul>
          {r.diagnosisNote && <p className="text-muted-foreground">{r.diagnosisNote}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1 font-medium">
            <Pill className="size-3.5" aria-hidden /> Đơn thuốc
          </p>
          {r.prescriptionItems.length === 0 ? (
            <p className="text-muted-foreground">Không kê đơn</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {r.prescriptionItems.map((p, i) => (
                <li key={i}>
                  <span className="font-medium">
                    {p.drugName} {p.strength}
                  </span>
                  <span className="text-muted-foreground">
                    {' '}
                    · {formatDecimal(p.quantity)} {p.unit}
                    {p.durationDays && ` · ${p.durationDays} ngày`}
                  </span>
                  <span className="text-muted-foreground block">{p.instructions}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Vitals r={r} />

        {(r.treatmentPlan || r.followUpDate) && (
          <div className="flex flex-col gap-1">
            <p className="font-medium">Lời dặn</p>
            {r.treatmentPlan && <p className="text-muted-foreground">{r.treatmentPlan}</p>}
            {r.followUpDate && (
              <p className="text-primary flex items-center gap-1.5">
                <CalendarClock className="size-3.5" aria-hidden /> Tái khám:{' '}
                {formatDate(r.followUpDate)}
              </p>
            )}
          </div>
        )}

        {r.clinicalImages.length > 0 && (
          <div className="flex flex-col gap-2 md:col-span-2">
            <p className="font-medium">Cận lâm sàng</p>
            <ClinicalImageGallery images={r.clinicalImages} />
          </div>
        )}

        {r.signedAt && (
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs md:col-span-2">
            <ShieldCheck className="size-3.5 text-emerald-600" aria-hidden />
            Đã ký xác nhận bởi {doctorName(r.doctor)} lúc {formatTime(r.signedAt)} ·{' '}
            {formatDate(r.signedAt)} · Mã hồ sơ <span className="font-mono">{r.code}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
