import type { Metadata } from 'next';

import { EncounterQueuePage } from '@/components/encounters/encounter-queue-page';

export const metadata: Metadata = { title: 'Khám bệnh' };

export default function Page() {
  return <EncounterQueuePage portal="province" />;
}
