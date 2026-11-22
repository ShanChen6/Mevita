import type { Metadata } from 'next';

import { RecordPage } from '@/components/encounters/record-page';

export const metadata: Metadata = { title: 'Phiếu khám' };

export default function Page({ params }: PageProps<'/province/encounters/[id]'>) {
  return <RecordPage params={params} portal="province" />;
}
