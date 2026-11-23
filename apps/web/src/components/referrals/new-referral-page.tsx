import Link from 'next/link';
import { Suspense } from 'react';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getRecord } from '@/lib/data/encounters';
import {
  findReferral,
  getDestinations,
  getEscorts,
  getTransportOptions,
} from '@/lib/data/referrals';
import { ageAt } from '@/lib/format';
import { gender } from '@/lib/labels';
import { ReferralForm } from './referral-form';
import { buildClinicalSummary, buildInitialTreatment } from './referral-summary';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function Content({
  searchParams,
  portal,
}: {
  searchParams: SearchParams;
  portal: 'commune' | 'province';
}) {
  const { record: recordId, to } = await searchParams;
  if (typeof recordId !== 'string') {
    return (
      <Card className="items-center gap-3 px-6 py-10 text-center">
        <p className="font-medium">Chọn bệnh nhân cần chuyển tuyến</p>
        <p className="text-muted-foreground max-w-md text-sm">
          Lệnh chuyển tuyến được tạo từ phiếu khám của bệnh nhân. Mở phiếu khám (hoặc tiếp nhận cấp
          cứu) rồi bấm “Chuyển tuyến khẩn cấp”.
        </p>
        <Button asChild>
          <Link href={`/${portal}/encounters`}>Đến hàng đợi khám</Link>
        </Button>
      </Card>
    );
  }
  const record = await getRecord(recordId);
  const priority = record.encounterType === 'EMERGENCY' ? 'CRITICAL' : 'URGENT';
  const [destinations, escorts, transport, previous] = await Promise.all([
    getDestinations(priority),
    getEscorts(),
    getTransportOptions(),
    // Hồ sơ tiếp nối của ca nhận để ổn định → chặng chuyển tiếp (Task A)
    record.sourceReferral ? findReferral(record.sourceReferral.id) : null,
  ]);
  const forward =
    previous?.acceptanceType === 'STABILIZE_FORWARD' &&
    previous.toFacility.id === record.facility.id
      ? previous
      : null;
  const now = new Date().toISOString();
  const primary = record.diagnoses.find((d) => d.isPrimary);
  const p = record.patient;
  return (
    <>
      <PageHeader
        title="Lệnh chuyển tuyến khẩn cấp"
        description={`${p.fullName} · ${gender[p.gender]}, ${ageAt(p.dateOfBirth, now)} tuổi · Phiếu ${record.code}`}
        actions={
          <Button variant="ghost" asChild>
            <Link href={`/${portal}/encounters/${record.id}`}>
              <ArrowLeft /> Về phiếu khám
            </Link>
          </Button>
        }
      />
      {p.allergies && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-500/10 dark:text-red-200"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden />{' '}
          <span className="font-semibold">Dị ứng:</span> {p.allergies}
        </p>
      )}
      {forward && (
        <p
          data-testid="forward-banner"
          className="rounded-lg border border-sky-300 bg-sky-50 p-3 text-sm text-sky-950 dark:bg-sky-500/10 dark:text-sky-100"
        >
          <span className="font-semibold">Chặng chuyển tiếp</span> của lệnh {forward.code} (
          {forward.fromFacility.name} → {forward.toFacility.name}). Toàn bộ hành trình và diễn biến
          các chặng trước sẽ được tuyến trên xem cùng phiếu này.
        </p>
      )}
      <ReferralForm
        // Dựng lại form khi đổi phiếu khám / bệnh viện chọn sẵn (Next giữ trạng thái trang cùng đường dẫn)
        key={`${record.id}-${typeof to === 'string' ? to : ''}`}
        portal={portal}
        recordId={record.id}
        destinations={destinations}
        escorts={escorts}
        transport={transport}
        initialTo={typeof to === 'string' ? to : undefined}
        defaults={{
          reason: forward?.forwardNote
            ? `Chuyển tiếp theo kế hoạch: ${forward.forwardNote}`
            : primary
              ? `${primary.icdCode} ${primary.name} — vượt khả năng chuyên môn, cần điều trị tuyến trên`
              : record.chiefComplaint,
          clinicalSummary: buildClinicalSummary(record, now),
          initialTreatment: buildInitialTreatment(record),
          priority,
        }}
      />
    </>
  );
}

export function NewReferralPage({
  searchParams,
  portal,
}: {
  searchParams: SearchParams;
  portal: 'commune' | 'province';
}) {
  return (
    <Suspense
      fallback={<div className="bg-muted/50 h-[70svh] animate-pulse rounded-xl border" aria-busy />}
    >
      <Content searchParams={searchParams} portal={portal} />
    </Suspense>
  );
}
