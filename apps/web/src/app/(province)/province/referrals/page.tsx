import type { Metadata } from 'next';

import { ReferralsPage } from '@/components/referrals/referrals-page';

export const metadata: Metadata = { title: 'Ca chuyển tuyến' };

export default function Page({ searchParams }: PageProps<'/province/referrals'>) {
  return <ReferralsPage searchParams={searchParams} portal="province" />;
}
