import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ProfileForm } from '@/components/patient/profile-form';
import { PageHeader } from '@/components/shared/page-header';
import { getCommunes, getMyProfile, getProvinces } from '@/lib/data/patient';

export const metadata: Metadata = { title: 'Hồ sơ sức khoẻ' };

async function ProfileLoader() {
  const [profile, provinces] = await Promise.all([getMyProfile(), getProvinces()]);
  const initialCommunes = profile.commune ? await getCommunes(profile.commune.province.code) : [];
  return (
    <ProfileForm
      profile={profile}
      provinces={provinces.map(({ code, name, fullName }) => ({ code, name, fullName }))}
      initialCommunes={initialCommunes.map(({ code, name, fullName }) => ({
        code,
        name,
        fullName,
      }))}
    />
  );
}

export default function ProfilePage() {
  return (
    <>
      <PageHeader
        title="Hồ sơ sức khoẻ"
        description="Thông tin định danh và tiền sử dùng khi đi khám."
      />
      <Suspense
        fallback={
          <div className="bg-muted/50 h-[640px] animate-pulse rounded-xl border" aria-busy />
        }
      >
        <ProfileLoader />
      </Suspense>
    </>
  );
}
