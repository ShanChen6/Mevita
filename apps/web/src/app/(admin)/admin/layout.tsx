import type { Metadata } from 'next';

import { AppShell } from '@/components/layout/app-shell';

export const metadata: Metadata = {
  title: { default: 'Quản trị', template: '%s · Quản trị · Mevita' },
};

export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return <AppShell portal="admin">{children}</AppShell>;
}
