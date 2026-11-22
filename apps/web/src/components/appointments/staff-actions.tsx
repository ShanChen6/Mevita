'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2, Stethoscope, UserX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { staffAppointmentAction } from '@/lib/actions/appointments';
import type { AppointmentStatusValue } from '@/lib/data/types';
import { CancelAppointmentDialog } from './cancel-dialog';

interface Props {
  id: string;
  status: AppointmentStatusValue;
  /** Đã tới giờ hẹn (mới được đánh dấu "không đến") */
  started: boolean;
  summary: string;
}

/** Các thao tác của quầy tiếp đón trên một lịch hẹn. */
export function StaffAppointmentActions({ id, status, started, summary }: Props) {
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const run = (action: 'confirm' | 'check-in' | 'no-show') =>
    startTransition(async () => {
      setRunning(action);
      const res = await staffAppointmentAction(id, action);
      setRunning(null);
      if (!res.ok) return setMessage({ ok: false, text: res.message });
      setMessage(
        action === 'check-in' && res.data.medicalRecord
          ? { ok: true, text: `Đã tạo phiếu khám ${res.data.medicalRecord.code}` }
          : null,
      );
    });

  const open = status === 'PENDING' || status === 'CONFIRMED';
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1">
        {status === 'PENDING' && (
          <Button size="sm" variant="outline" onClick={() => run('confirm')} disabled={pending}>
            {running === 'confirm' ? <Loader2 className="animate-spin" /> : <Check />} Duyệt
          </Button>
        )}
        {open && (
          <Button size="sm" onClick={() => run('check-in')} disabled={pending}>
            {running === 'check-in' ? <Loader2 className="animate-spin" /> : <Stethoscope />} Tiếp
            đón
          </Button>
        )}
        {open && started && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => run('no-show')}
            disabled={pending}
            title="Bệnh nhân không đến"
          >
            {running === 'no-show' ? <Loader2 className="animate-spin" /> : <UserX />}
            <span className="sr-only sm:not-sr-only">Không đến</span>
          </Button>
        )}
        {open && (
          <CancelAppointmentDialog
            appointmentId={id}
            summary={summary}
            size="icon"
            triggerLabel="Huỷ lịch"
          />
        )}
      </div>
      {message && (
        <p
          role="status"
          className={
            message.ok
              ? 'text-xs text-emerald-700 dark:text-emerald-400'
              : 'text-destructive text-xs'
          }
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
