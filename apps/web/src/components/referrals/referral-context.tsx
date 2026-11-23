import Link from 'next/link';
import { Ambulance, Building2, Phone, Stethoscope } from 'lucide-react';

import { ClinicalImageGallery } from '@/components/patient/clinical-image-gallery';
import type { Referral, VitalLog } from '@/lib/data/types';
import { formatDateTime, formatDecimal } from '@/lib/format';
import { LiveVitalsPanel } from './live-vitals-panel';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs font-medium uppercase">{label}</span>
      <div className="whitespace-pre-line text-sm">{children}</div>
    </div>
  );
}

/**
 * Bối cảnh chuyển tuyến trên hồ sơ điều trị tiếp nối (Task 5.1): toàn bộ dữ liệu tuyến dưới — phiếu khám,
 * tóm tắt, xử trí, thuốc đã dùng, ảnh, diễn biến trên xe — để bác sĩ tuyến trên không phải hỏi lại từ đầu.
 */
export function ReferralContext({
  referral: r,
  vitals,
  portal,
}: {
  referral: Referral;
  vitals: VitalLog[];
  portal: string;
}) {
  const src = r.sourceRecord;
  const v = [
    src.pulse != null && `Mạch ${src.pulse}`,
    src.systolicBp != null && `HA ${src.systolicBp}/${src.diastolicBp}`,
    src.temperature != null && `${formatDecimal(src.temperature)}°C`,
    src.respiratoryRate != null && `NT ${src.respiratoryRate}`,
    src.spo2 != null && `SpO2 ${src.spo2}%`,
  ].filter(Boolean);
  return (
    <details
      open
      className="bg-card group rounded-xl border border-sky-300 dark:border-sky-500/40"
      data-testid="referral-context"
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-4 font-semibold">
        <Ambulance className="size-5 text-sky-600" aria-hidden />
        Hồ sơ chuyển tuyến {r.code} từ {r.fromFacility.name}
        <span className="text-muted-foreground text-sm font-normal">
          · khám {formatDateTime(src.visitAt)}
          {r.arrivedAt && ` · tiếp nhận ${formatDateTime(r.arrivedAt)}`}
        </span>
        <span className="text-primary ml-auto text-sm font-normal group-open:hidden">Mở</span>
        <span className="text-primary ml-auto hidden text-sm font-normal group-open:inline">
          Thu gọn
        </span>
      </summary>
      <div className="flex flex-col gap-4 border-t p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Row label="Lý do chuyển tuyến">{r.reason}</Row>
            <Row label="Lý do khám tại tuyến dưới">{src.chiefComplaint}</Row>
            {src.symptoms && <Row label="Bệnh sử">{src.symptoms}</Row>}
            {src.physicalExamination && (
              <Row label="Khám tại tuyến dưới">{src.physicalExamination}</Row>
            )}
            {v.length > 0 && <Row label="Sinh tồn lúc khám">{v.join(' · ')}</Row>}
          </div>
          <div className="flex flex-col gap-3">
            {src.diagnoses.length > 0 && (
              <Row label="Chẩn đoán tuyến dưới">
                {src.diagnoses.map((d) => (
                  <span key={d.icdCode} className="block">
                    <span className="font-mono text-xs font-semibold">{d.icdCode}</span> {d.name}
                    {d.isPrimary && <span className="text-muted-foreground"> (chính)</span>}
                  </span>
                ))}
              </Row>
            )}
            {r.initialTreatment && <Row label="Xử trí sơ cứu">{r.initialTreatment}</Row>}
            {src.prescriptionItems.length > 0 && (
              <Row label="Thuốc đã dùng">
                {src.prescriptionItems.map((d, i) => (
                  <span key={i} className="block">
                    {d.drugName} {d.strength} — {d.quantity} {d.unit}: {d.instructions}
                  </span>
                ))}
              </Row>
            )}
            <Row label="Liên lạc tuyến dưới">
              <span className="flex items-center gap-1.5">
                <Stethoscope className="size-3.5" aria-hidden /> {r.referredBy.name}
                {r.referredBy.phone && (
                  <a className="text-primary" href={`tel:${r.referredBy.phone}`}>
                    {r.referredBy.phone}
                  </a>
                )}
              </span>
              {(r.fromFacility.emergencyPhone ?? r.fromFacility.phone) && (
                <span className="flex items-center gap-1.5">
                  <Building2 className="size-3.5" aria-hidden /> {r.fromFacility.name}
                  <Phone className="size-3" aria-hidden />{' '}
                  {r.fromFacility.emergencyPhone ?? r.fromFacility.phone}
                </span>
              )}
            </Row>
          </div>
        </div>
        <Row label="Tóm tắt bệnh án khi chuyển">{r.clinicalSummary}</Row>
        {r.sourceImages && r.sourceImages.length > 0 && (
          <Row label={`Ảnh cận lâm sàng tuyến dưới (${r.sourceImages.length})`}>
            <ClinicalImageGallery images={r.sourceImages} />
          </Row>
        )}
        <LiveVitalsPanel referralId={r.id} initial={vitals} escort={r.escort?.name ?? null} />
        <Link
          className="text-primary self-start text-sm underline-offset-4 hover:underline"
          href={`/${portal}/referrals/${r.id}`}
        >
          Xem phiếu chuyển tuyến đầy đủ
        </Link>
      </div>
    </details>
  );
}
