import Link from 'next/link';
import { Suspense } from 'react';
import { AlertTriangle, ArrowLeft, FileHeart } from 'lucide-react';

import { RecordTimeline } from '@/components/patient/record-timeline';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { loadPatientRecords } from '@/lib/actions/patients';
import { getPatientForStaff } from '@/lib/data/staff-patients';
import { ageAt, formatDate } from '@/lib/format';
import { bloodType, gender } from '@/lib/labels';

async function History({
  params,
  portal,
}: {
  params: Promise<{ id: string }>;
  portal: 'commune' | 'province';
}) {
  const { id } = await params;
  const { profile: p, records } = await getPatientForStaff(id);
  return (
    <>
      <PageHeader
        title={p.fullName}
        description={[
          `${gender[p.gender]}, ${ageAt(p.dateOfBirth, new Date().toISOString())} tuổi (${formatDate(p.dateOfBirth)})`,
          p.nationalId && `CCCD ${p.nationalId}`,
          p.healthInsuranceNumber && `BHYT ${p.healthInsuranceNumber}`,
          `Nhóm máu ${bloodType[p.bloodType]}`,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <Button variant="outline" asChild>
            <Link href={`/${portal}/patients`}>
              <ArrowLeft /> Tra cứu khác
            </Link>
          </Button>
        }
      />
      {p.allergies && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-500/10 dark:text-red-200"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <span>
            <span className="font-semibold">Dị ứng:</span> {p.allergies}
            {p.chronicConditions && ` · Bệnh mạn tính: ${p.chronicConditions}`}
          </span>
        </div>
      )}
      {records.items.length === 0 ? (
        <Card className="items-center gap-2 px-6 py-10 text-center">
          <FileHeart className="text-muted-foreground size-8" aria-hidden />
          <p className="text-muted-foreground text-sm">Chưa có lần khám nào đã ký trên hệ thống.</p>
        </Card>
      ) : (
        <RecordTimeline initial={records} loadMore={loadPatientRecords.bind(null, p.id)} />
      )}
    </>
  );
}

/** Lịch sử khám đầy đủ của một bệnh nhân (mọi cơ sở) — dùng chung cho Tuyến Xã và Tuyến Tỉnh. */
export function PatientHistoryPage({
  params,
  portal,
}: {
  params: Promise<{ id: string }>;
  portal: 'commune' | 'province';
}) {
  return (
    <Suspense
      fallback={<div className="bg-muted/50 h-96 animate-pulse rounded-xl border" aria-busy />}
    >
      <History params={params} portal={portal} />
    </Suspense>
  );
}
