import type { Metadata } from 'next';

import { AppShell } from '@/components/layout/app-shell';

export const metadata: Metadata = {
  title: { default: 'Cổng Bệnh nhân', template: '%s · Bệnh nhân · Mevita' },
};

export default function PatientLayout({ children }: LayoutProps<'/patient'>) {
  return <AppShell portal="patient">{children}</AppShell>;
}
