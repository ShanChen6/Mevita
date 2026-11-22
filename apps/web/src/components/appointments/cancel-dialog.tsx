'use client';

import { useState, useTransition } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Loader2, X } from 'lucide-react';

import { FormError } from '@/components/auth/form-message';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cancelAppointment } from '@/lib/actions/appointments';

interface Props {
  appointmentId: string;
  summary: string;
  /** Nhãn nút mở hộp thoại */
  triggerLabel?: string;
  size?: 'sm' | 'default' | 'icon';
}

/** Hộp thoại xác nhận huỷ lịch hẹn kèm lý do. */
export function CancelAppointmentDialog({
  appointmentId,
  summary,
  triggerLabel = 'Huỷ lịch',
  size = 'sm',
}: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const res = await cancelAppointment(appointmentId, reason);
      if (!res.ok) return setError(res.message);
      setOpen(false);
      setReason('');
      setError(null);
    });

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button
          variant="outline"
          size={size}
          aria-label={size === 'icon' ? triggerLabel : undefined}
        >
          <X /> {size !== 'icon' && triggerLabel}
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content className="bg-background data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border p-6 shadow-lg">
          <DialogPrimitive.Title className="text-lg font-semibold">
            Huỷ lịch hẹn?
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-muted-foreground text-sm">
            {summary}
          </DialogPrimitive.Description>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`reason-${appointmentId}`}>Lý do huỷ</Label>
            <Textarea
              id={`reason-${appointmentId}`}
              rows={2}
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Bận việc đột xuất"
            />
          </div>
          <FormError message={error ?? undefined} />
          <div className="flex justify-end gap-2">
            <DialogPrimitive.Close asChild>
              <Button variant="ghost">Giữ lịch</Button>
            </DialogPrimitive.Close>
            <Button
              variant="destructive"
              onClick={submit}
              disabled={pending || reason.trim().length < 3}
            >
              {pending && <Loader2 className="animate-spin" />} Xác nhận huỷ
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
