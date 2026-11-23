'use client';

import { useTransition } from 'react';
import { Loader2, Lock, LockOpen } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { setUserActive } from '@/lib/actions/admin';

/** Khoá / mở khoá tài khoản; khoá thì người dùng bị đăng xuất khỏi mọi thiết bị (khi access token hết hạn). */
export function UserActiveToggle({
  id,
  name,
  isActive,
  self,
}: {
  id: string;
  name: string;
  isActive: boolean;
  self: boolean;
}) {
  const [pending, start] = useTransition();
  if (self) return <span className="text-muted-foreground text-xs">Tài khoản của bạn</span>;
  return (
    <Button
      size="sm"
      variant={isActive ? 'outline' : 'default'}
      disabled={pending}
      onClick={() => {
        if (
          isActive &&
          !window.confirm(`Khoá tài khoản ${name}? Người này sẽ không đăng nhập được nữa.`)
        )
          return;
        start(async () => {
          const res = await setUserActive(id, !isActive);
          if (!res.ok) toast.error(res.message);
          else toast.success(isActive ? `Đã khoá ${name}` : `Đã mở khoá ${name}`);
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : isActive ? <Lock /> : <LockOpen />}
      {isActive ? 'Khoá' : 'Mở khoá'}
    </Button>
  );
}
