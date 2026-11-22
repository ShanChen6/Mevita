import type { Metadata } from 'next';

import { AppShell } from '@/components/layout/app-shell';

export const metadata: Metadata = {
  title: { default: 'Bệnh viện Tuyến Tỉnh', template: '%s · Tuyến Tỉnh · Mevita' },
};

export default function ProvinceLayout({ children }: LayoutProps<'/province'>) {
  return <AppShell portal="province">{children}</AppShell>;
}
