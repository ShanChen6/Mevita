'use client';

import { useState, useTransition } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Loader2, XCircle } from 'lucide-react';

import { FormError } from '@/components/auth/form-message';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cancelReferral } from '@/lib/actions/referrals';

/** Huỷ lệnh chuyển tuyến (gia đình xin chuyển nơi khác, bệnh nhân tử vong, gửi nhầm…). */
export function CancelReferralButton({ id, code }: { id: string; code: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await cancelReferral(id, reason);
      if (!res.ok) return setError(res.message);
      setOpen(false);
    });
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive">
          <XCircle /> Huỷ
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content className="bg-background fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border p-6 shadow-lg">
          <DialogPrimitive.Title className="text-lg font-semibold">
            Huỷ lệnh {code}?
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-muted-foreground text-sm">
            Bệnh viện nhận được thông báo huỷ ngay lập tức.
          </DialogPrimitive.Description>
          <form onSubmit={submit} className="flex flex-col gap-3">
            <Label htmlFor={`cancel-${id}`}>Lý do huỷ</Label>
            <Textarea
              id={`cancel-${id}`}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <FormError message={error ?? undefined} />
            <div className="flex justify-end gap-2">
              <DialogPrimitive.Close asChild>
                <Button type="button" variant="ghost">
                  Đóng
                </Button>
              </DialogPrimitive.Close>
              <Button
                type="submit"
                variant="destructive"
                disabled={pending || reason.trim().length < 3}
              >
                {pending && <Loader2 className="animate-spin" />} Xác nhận huỷ
              </Button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
