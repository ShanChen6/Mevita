import type { Metadata } from 'next';

import { ReceptionPage } from '@/components/appointments/reception-page';

export const metadata: Metadata = { title: 'Tiếp đón & Lịch hẹn' };

export default function CommuneReceptionPage({ searchParams }: PageProps<'/commune/appointments'>) {
  return <ReceptionPage title="Tiếp đón & Lịch hẹn" searchParams={searchParams} />;
}
