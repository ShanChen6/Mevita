import type { Metadata } from 'next';

import { AppShell } from '@/components/layout/app-shell';

export const metadata: Metadata = {
  title: { default: 'Trạm Y tế Xã', template: '%s · Tuyến Xã · Mevita' },
};

export default function CommuneLayout({ children }: LayoutProps<'/commune'>) {
  return <AppShell portal="commune">{children}</AppShell>;
}
