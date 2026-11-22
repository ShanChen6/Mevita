import Link from 'next/link';
import { LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Brand } from './brand';
import { MobileNav } from './mobile-nav';
import type { Portal } from './portals';
import { SidebarNav } from './sidebar-nav';

interface AppShellProps {
  portal: Portal;
  user: { name: string; subtitle: string };
  children: React.ReactNode;
}

function initials(name: string) {
  const parts = name
    .replace(/^(BS|ĐD|ThS|TS)\.\s*/i, '')
    .trim()
    .split(/\s+/);
  return parts
    .slice(-2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

/** Khung giao diện chung cho 3 phân hệ: sidebar (desktop), menu trượt (mobile), thanh trên cùng. */
export function AppShell({ portal, user, children }: AppShellProps) {
  return (
    <div className="flex min-h-svh w-full">
      <aside className="bg-card sticky top-0 hidden h-svh w-64 shrink-0 flex-col gap-6 border-r p-4 lg:flex">
        <Brand portal={portal} />
        <SidebarNav portal={portal} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-4 backdrop-blur sm:px-6">
          <MobileNav portal={portal} />
          <div className="lg:hidden">
            <span className="text-sm font-bold">Mevita</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{user.name}</p>
              <p className="text-muted-foreground text-xs leading-tight">{user.subtitle}</p>
            </div>
            <span
              aria-hidden
              className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full text-xs font-semibold"
            >
              {initials(user.name)}
            </span>
            <Button variant="ghost" size="icon" asChild aria-label="Đăng xuất">
              <Link href="/login">
                <LogOut />
              </Link>
            </Button>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
