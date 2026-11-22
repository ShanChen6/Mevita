import type { Metadata } from 'next';

import { ReceptionPage } from '@/components/appointments/reception-page';

export const metadata: Metadata = { title: 'Lịch hẹn khám' };

export default function ProvinceReceptionPage({
  searchParams,
}: PageProps<'/province/appointments'>) {
  return <ReceptionPage title="Lịch hẹn khám" searchParams={searchParams} />;
}
