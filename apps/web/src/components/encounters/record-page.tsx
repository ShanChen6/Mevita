import Link from 'next/link';
import { Suspense } from 'react';
import { Ambulance, ArrowLeft, History, ShieldAlert, ShieldCheck } from 'lucide-react';

import { RecordCard } from '@/components/patient/record-card';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { getFacilitySpecialties, getRecord, verifyRecord } from '@/lib/data/encounters';
import type { MedicalRecordDetail, MedicalRecordItem } from '@/lib/data/types';
import { ageAt, formatDate } from '@/lib/format';
import { bloodType, encounterType, gender } from '@/lib/labels';
import { ExamForm } from './exam-form';

/** Chuyển chi tiết phiếu khám sang dạng thẻ lịch sử để hiển thị bản đã ký. */
function toItem(r: MedicalRecordDetail): MedicalRecordItem {
  return {
    ...r,
    facility: {
      id: r.facility.id,
      name: r.facility.name,
      type: 'COMMUNE_HEALTH_STATION',
      address: '',
    },
  };
}

async function Integrity({ id }: { id: string }) {
  const v = await verifyRecord(id);
  return v.valid ? (
    <p className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">
      <ShieldCheck className="size-4" aria-hidden /> Hồ sơ toàn vẹn — nội dung khớp với chữ ký lúc
      ký xác nhận.
    </p>
  ) : (
    <p
      role="alert"
      className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-500/10 dark:text-red-200"
    >
      <ShieldAlert className="size-4" aria-hidden /> Cảnh báo: nội dung hồ sơ không khớp với chữ ký
      — có thể đã bị sửa sau khi ký.
    </p>
  );
}

async function Record({
  params,
  portal,
}: {
  params: Promise<{ id: string }>;
  portal: 'commune' | 'province';
}) {
  const { id } = await params;
  const record = await getRecord(id);
  const p = record.patient;
  const header = (
    <PageHeader
      title={p.fullName}
      description={[
        `${gender[p.gender]}, ${ageAt(p.dateOfBirth, new Date().toISOString())} tuổi (${formatDate(p.dateOfBirth)})`,
        p.nationalId && `CCCD ${p.nationalId}`,
        p.healthInsuranceNumber && `BHYT ${p.healthInsuranceNumber}`,
        `Nhóm máu ${bloodType[p.bloodType]}`,
        `${encounterType[record.encounterType]} · Phiếu ${record.code}`,
      ]
        .filter(Boolean)
        .join(' · ')}
      actions={
        <>
          <Button variant="destructive" asChild>
            <Link href={`/${portal}/referrals/new?record=${record.id}`}>
              <Ambulance /> Chuyển tuyến khẩn cấp
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/${portal}/patients/${p.id}`}>
              <History /> Lịch sử khám
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href={`/${portal}/encounters`}>
              <ArrowLeft /> Hàng đợi
            </Link>
          </Button>
        </>
      }
    />
  );

  if (record.status === 'FINALIZED') {
    return (
      <>
        {header}
        <Suspense>
          <Integrity id={record.id} />
        </Suspense>
        <RecordCard record={toItem(record)} />
      </>
    );
  }

  const specialties = await getFacilitySpecialties(record.facility.id);
  return (
    <>
      {header}
      <ExamForm key={record.updatedAt} record={record} specialties={specialties} />
    </>
  );
}

/** Phiếu khám: nháp → form khám; đã ký → bản chỉ xem kèm kiểm tra toàn vẹn. */
export function RecordPage({
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
      <Record params={params} portal={portal} />
    </Suspense>
  );
}
