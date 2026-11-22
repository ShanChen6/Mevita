'use client';

import { useState, useTransition } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Loader2, Signature } from 'lucide-react';

import { FormError } from '@/components/auth/form-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  /** Lưu nháp trước khi ký; trả false nếu lưu không thành công */
  beforeSign: () => Promise<boolean>;
  onSign: (password: string) => Promise<string | null>;
  disabled?: boolean;
  summary: string;
}

/** Ký xác nhận hồ sơ: bác sĩ nhập lại mật khẩu (tương đương chữ ký). */
export function SignDialog({ beforeSign, onSign, disabled, summary }: Props) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      if (!(await beforeSign())) {
        setOpen(false);
        return;
      }
      const message = await onSign(password);
      if (message) return setError(message);
      setOpen(false);
      setPassword('');
      setError(null);
    });
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => (setOpen(o), setError(null))}>
      <DialogPrimitive.Trigger asChild>
        <Button type="button" disabled={disabled}>
          <Signature /> Ký xác nhận & hoàn tất khám
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content className="bg-background data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border p-6 shadow-lg">
          <DialogPrimitive.Title className="text-lg font-semibold">
            Ký xác nhận hồ sơ khám
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-muted-foreground text-sm">
            {summary} Sau khi ký, hồ sơ được khoá và không thể chỉnh sửa. Tên bạn sẽ được ghi là bác
            sĩ khám.
          </DialogPrimitive.Description>
          <form onSubmit={submit} className="flex flex-col gap-3">
            <Label htmlFor="sign-password">Nhập lại mật khẩu để ký</Label>
            <Input
              id="sign-password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <FormError message={error ?? undefined} />
            <div className="flex justify-end gap-2">
              <DialogPrimitive.Close asChild>
                <Button type="button" variant="ghost">
                  Huỷ
                </Button>
              </DialogPrimitive.Close>
              <Button type="submit" disabled={pending || !password}>
                {pending ? <Loader2 className="animate-spin" /> : <Signature />} Ký hồ sơ
              </Button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
