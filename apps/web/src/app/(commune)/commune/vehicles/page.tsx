import type { Metadata } from 'next';

import { VehiclesPage } from '@/components/vehicles/vehicles-page';

export const metadata: Metadata = { title: 'Xe chuyển viện' };

export default function Page() {
  return <VehiclesPage portal="commune" />;
}
