import type { Metadata } from 'next';

import { AppShell } from '@/components/layout/app-shell';
import { currentUsers } from '@/lib/mock-data';

export const metadata: Metadata = {
  title: { default: 'Cổng Bệnh nhân', template: '%s · Bệnh nhân · Mevita' },
};

export default function PatientLayout({ children }: LayoutProps<'/patient'>) {
  return (
    <AppShell portal="patient" user={currentUsers.patient}>
      {children}
    </AppShell>
  );
}
