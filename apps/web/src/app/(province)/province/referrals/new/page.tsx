import type { Metadata } from 'next';

import { NewReferralPage } from '@/components/referrals/new-referral-page';

export const metadata: Metadata = { title: 'Chuyển tuyến khẩn cấp' };

export default function Page({ searchParams }: PageProps<'/province/referrals/new'>) {
  return <NewReferralPage searchParams={searchParams} portal="province" />;
}
