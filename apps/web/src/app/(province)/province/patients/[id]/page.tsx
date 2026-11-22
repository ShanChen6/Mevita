import type { Metadata } from 'next';

import { PatientHistoryPage } from '@/components/lookup/patient-history-page';

export const metadata: Metadata = { title: 'Lịch sử khám bệnh nhân' };

export default function Page({ params }: PageProps<'/province/patients/[id]'>) {
  return <PatientHistoryPage params={params} portal="province" />;
}
