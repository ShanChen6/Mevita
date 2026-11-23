import type { Metadata } from 'next';

import { ReferralsPage } from '@/components/referrals/referrals-page';

export const metadata: Metadata = { title: 'Chuyển tuyến' };

export default function Page({ searchParams }: PageProps<'/commune/referrals'>) {
  return <ReferralsPage searchParams={searchParams} portal="commune" />;
}
