import type { Metadata } from 'next';

import { PatientLookup } from '@/components/lookup/patient-lookup';
import { PageHeader } from '@/components/shared/page-header';

export const metadata: Metadata = { title: 'Tra cứu bệnh nhân' };

export default function ProvincePatientLookupPage() {
  return (
    <>
      <PageHeader
        title="Tra cứu bệnh nhân"
        description="Tìm nhanh theo số CCCD, mã thẻ BHYT, số điện thoại hoặc mã lịch hẹn."
      />
      <PatientLookup portal="province" />
    </>
  );
}
