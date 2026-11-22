'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import { portals, type NavItem, type Portal } from './portals';

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

interface ViewProps {
  portal: Portal;
  pathname: string | null;
  onNavigate?: () => void;
}

function SidebarNavView({ portal, pathname, onNavigate }: ViewProps) {
  return (
    <nav aria-label="Điều hướng chính" className="flex flex-col gap-1">
      {portals[portal].nav.map((item) => {
        const active = pathname !== null && isActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ActiveSidebarNav(props: Omit<ViewProps, 'pathname'>) {
  return <SidebarNavView {...props} pathname={usePathname()} />;
}

/**
 * Menu điều hướng, tô sáng mục đang xem. Đọc URL phải nằm trong <Suspense> để các trang động
 * vẫn dựng sẵn được khung tĩnh — trong lúc chờ, hiển thị menu chưa tô sáng.
 */
export function SidebarNav(props: Omit<ViewProps, 'pathname'>) {
  return (
    <Suspense fallback={<SidebarNavView {...props} pathname={null} />}>
      <ActiveSidebarNav {...props} />
    </Suspense>
  );
}
