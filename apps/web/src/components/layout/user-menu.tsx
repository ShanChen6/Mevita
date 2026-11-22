import { LogOut } from 'lucide-react';

import { logout } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/lib/auth/session';

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

/** Thông tin người dùng đang đăng nhập + nút đăng xuất. Đọc phiên nên phải nằm trong <Suspense>. */
export async function UserMenu() {
  const user = await getCurrentUser();
  return (
    <>
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium leading-tight">{user.displayName}</p>
        <p className="text-muted-foreground text-xs leading-tight">{user.subtitle}</p>
      </div>
      <span
        aria-hidden
        className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full text-xs font-semibold"
      >
        {initials(user.fullName)}
      </span>
      <form action={logout}>
        <Button type="submit" variant="ghost" size="icon" aria-label="Đăng xuất">
          <LogOut />
        </Button>
      </form>
    </>
  );
}

export function UserMenuSkeleton() {
  return (
    <>
      <div className="hidden flex-col items-end gap-1 sm:flex">
        <span className="bg-muted h-3.5 w-28 animate-pulse rounded" />
        <span className="bg-muted h-3 w-40 animate-pulse rounded" />
      </div>
      <span className="bg-muted size-8 animate-pulse rounded-full" />
    </>
  );
}
