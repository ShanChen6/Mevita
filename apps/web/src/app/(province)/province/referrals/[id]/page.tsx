import type { Metadata } from 'next';

import { ReferralDetailPage } from '@/components/referrals/referral-detail-page';

export const metadata: Metadata = { title: 'Chi tiết ca chuyển tuyến' };

export default function Page({ params }: PageProps<'/province/referrals/[id]'>) {
  return <ReferralDetailPage params={params} portal="province" />;
}
