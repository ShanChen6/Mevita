import type { Metadata } from 'next';
import { Suspense } from 'react';

import { BookingWizard } from '@/components/appointments/booking-wizard';
import { PageHeader } from '@/components/shared/page-header';
import { apiFetch } from '@/lib/api';
import { getMyProfile, getProvinces } from '@/lib/data/patient';
import type { FacilitySummary } from '@/lib/data/types';
import { vnDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Đặt lịch khám' };

async function Wizard() {
  const [profile, provinces] = await Promise.all([getMyProfile(), getProvinces()]);
  // Mặc định tìm cơ sở trong tỉnh của bệnh nhân
  const provinceCode = profile.commune?.province.code ?? '';
  const facilities = await apiFetch<FacilitySummary[]>(
    `/facilities${provinceCode ? `?provinceCode=${provinceCode}` : ''}`,
  );
  return (
    <BookingWizard
      today={vnDate()}
      provinces={provinces.map(({ code, name, fullName }) => ({ code, name, fullName }))}
      defaultProvinceCode={provinceCode}
      initialFacilities={facilities}
    />
  );
}

export default function BookAppointmentPage() {
  return (
    <>
      <PageHeader
        title="Đặt lịch khám"
        description="3 bước: chọn nơi khám, chọn giờ, mô tả triệu chứng."
      />
      <Suspense
        fallback={<div className="bg-muted/50 h-96 animate-pulse rounded-xl border" aria-busy />}
      >
        <Wizard />
      </Suspense>
    </>
  );
}
