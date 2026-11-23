import { connection } from 'next/server';

import { getPickupRequests, getVehicles } from '@/lib/data/referrals';
import { PickupRequests } from './pickup-requests';

/** Phần "Yêu cầu xe đón" trên trang tổng quan (tự làm mới qua ReferralLiveRefresh). */
export async function PickupRequestsSection() {
  await connection();
  const [requests, vehicles] = await Promise.all([getPickupRequests(), getVehicles()]);
  return <PickupRequests requests={requests} vehicles={vehicles} now={new Date().toISOString()} />;
}
