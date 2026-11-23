'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Dialog as DialogPrimitive } from 'radix-ui';
import {
  Ambulance,
  CheckCheck,
  ClipboardPlus,
  Clock,
  FileText,
  Loader2,
  LogIn,
  Pencil,
  X,
  XCircle,
} from 'lucide-react';

import { FormError } from '@/components/auth/form-message';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  acceptReferral,
  arriveReferral,
  rejectReferral,
  updatePreparation,
} from '@/lib/actions/referrals';
import type { Referral } from '@/lib/data/types';
import { formatDateTime } from '@/lib/format';

const PRESETS = [
  'Đã chuẩn bị phòng mổ',
  'Dự trù 2 đơn vị máu',
  'Hồi sức cấp cứu sẵn sàng',
  'Đã báo kíp phẫu thuật thần kinh',
  'Chụp CT ngay khi tới',
];

function RejectDialog({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button variant="outline">
          <X /> Không thể tiếp nhận
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content className="bg-background fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border p-6 shadow-lg">
          <DialogPrimitive.Title className="text-lg font-semibold">
            Không thể tiếp nhận ca này?
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-muted-foreground text-sm">
            Tuyến dưới nhận lý do ngay và chuyển bệnh nhân tới bệnh viện khác. Chỉ từ chối khi thật
            sự không đủ điều kiện.
          </DialogPrimitive.Description>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await rejectReferral(id, reason);
                if (!res.ok) return setError(res.message);
                setOpen(false);
              });
            }}
          >
            <Label htmlFor="reject-reason">Lý do</Label>
            <Textarea
              id="reject-reason"
              rows={3}
              value={reason}
              placeholder="VD: Hết giường hồi sức, máy thở đang dùng hết"
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
                disabled={pending || reason.trim().length < 5}
              >
                {pending && <Loader2 className="animate-spin" />} Xác nhận không tiếp nhận
              </Button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Xe đã tới: xác nhận bàn giao, mở hồ sơ điều trị tiếp nối rồi chuyển thẳng vào trang khám. */
function ArriveButton({ id, patient }: { id: string; patient: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button size="lg" className="h-auto whitespace-normal py-2">
          <LogIn /> Xe đã tới — Tiếp nhận bệnh nhân
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content className="bg-background fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border p-6 shadow-lg">
          <DialogPrimitive.Title className="text-lg font-semibold">
            Tiếp nhận {patient}?
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-muted-foreground text-sm">
            Phiếu chuyển tuyến chuyển sang “Đã tiếp nhận” và hệ thống mở hồ sơ điều trị tiếp nối —
            điền sẵn bệnh sử, tóm tắt chuyển tuyến, xử trí tuyến dưới, sinh tồn mới nhất trên xe và
            chẩn đoán làm việc.
          </DialogPrimitive.Description>
          <FormError message={error ?? undefined} />
          <div className="flex justify-end gap-2">
            <DialogPrimitive.Close asChild>
              <Button type="button" variant="ghost">
                Đóng
              </Button>
            </DialogPrimitive.Close>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await arriveReferral(id);
                  if (!res.ok) return setError(res.message);
                  router.push(`/province/encounters/${res.data.recordId}`);
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : <ClipboardPlus />} Tiếp nhận & mở hồ
              sơ điều trị
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function NoteEditor({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: string;
  submitLabel: React.ReactNode;
  onSubmit: (note: string) => Promise<string | null>;
  onCancel?: () => void;
}) {
  const [note, setNote] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => setError(await onSubmit(note)));
      }}
    >
      <Label htmlFor="prep">Ghi chú chuẩn bị (gửi cho tuyến dưới & người đi kèm)</Label>
      <Textarea
        id="prep"
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="VD: Đã chuẩn bị phòng mổ số 2, dự trù 2 đơn vị máu O"
      />
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <Button
            key={p}
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() =>
              setNote((n) =>
                n.trim() ? `${n.trim().replace(/[.,;]$/, '')}, ${p.toLowerCase()}` : p,
              )
            }
          >
            + {p}
          </Button>
        ))}
      </div>
      <FormError message={error ?? undefined} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          size="lg"
          className="h-auto whitespace-normal py-2"
          disabled={pending}
        >
          {pending ? <Loader2 className="animate-spin" /> : <CheckCheck />} {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Huỷ sửa
          </Button>
        )}
      </div>
    </form>
  );
}

/**
 * Phản hồi của bệnh viện nhận: bác sĩ trực bấm "Xác nhận tiếp nhận & Sẵn sàng ê-kíp" kèm ghi chú chuẩn bị,
 * hoặc "Không thể tiếp nhận". Phía gửi xem trạng thái phản hồi.
 */
export function ReferralResponse({
  referral: r,
  canRespond,
  portal,
}: {
  referral: Referral;
  canRespond: boolean;
  portal: string;
}) {
  const [editing, setEditing] = useState(false);

  if (r.status === 'PENDING') {
    if (!canRespond)
      return (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <Clock className="size-4 shrink-0" aria-hidden /> Đang chờ {r.toFacility.name} xác nhận
          tiếp nhận.
        </div>
      );
    return (
      <section
        className="flex flex-col gap-4 rounded-xl border-2 border-red-300 bg-red-50/50 p-4 dark:border-red-500/40 dark:bg-red-500/5"
        aria-label="Phản hồi tuyến dưới"
      >
        <p className="font-semibold">
          Ca đang chờ bệnh viện phản hồi — tuyến dưới nhận xác nhận ngay khi bạn bấm.
        </p>
        <NoteEditor
          initial=""
          submitLabel="Xác nhận tiếp nhận & Sẵn sàng ê-kíp"
          onSubmit={async (note) => {
            const res = await acceptReferral(r.id, note);
            return res.ok ? null : res.message;
          }}
        />
        <div className="flex flex-wrap gap-2">
          <RejectDialog id={r.id} />
          <ArriveButton id={r.id} patient={r.patient.fullName} />
        </div>
      </section>
    );
  }

  if (r.status === 'ACCEPTED')
    return (
      <section
        className="flex flex-col gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950 dark:bg-emerald-500/10 dark:text-emerald-100"
        data-testid="accepted-banner"
      >
        <p className="flex items-center gap-2 font-semibold">
          <CheckCheck className="size-5" aria-hidden /> {r.toFacility.name} đã tiếp nhận & sẵn sàng
          ê-kíp
        </p>
        <p>
          {r.acceptedBy?.name} xác nhận lúc {r.acceptedAt && formatDateTime(r.acceptedAt)}
        </p>
        {editing ? (
          <div className="bg-background text-foreground rounded-lg p-3">
            <NoteEditor
              initial={r.preparationNote ?? ''}
              submitLabel="Lưu & báo tuyến dưới"
              onCancel={() => setEditing(false)}
              onSubmit={async (note) => {
                const res = await updatePreparation(r.id, note);
                if (res.ok) setEditing(false);
                return res.ok ? null : res.message;
              }}
            />
          </div>
        ) : (
          <div className="flex flex-wrap items-start gap-2">
            <p className="flex-1">
              <span className="font-medium">Chuẩn bị: </span>
              {r.preparationNote ?? 'Chưa có ghi chú'}
            </p>
            {canRespond && (
              <Button
                size="sm"
                variant="outline"
                className="bg-background"
                onClick={() => setEditing(true)}
              >
                <Pencil /> Cập nhật
              </Button>
            )}
          </div>
        )}
        {canRespond && !editing && (
          <div>
            <ArriveButton id={r.id} patient={r.patient.fullName} />
          </div>
        )}
      </section>
    );

  if (r.status === 'ARRIVED')
    return (
      <section
        className="flex flex-col gap-2 rounded-xl border border-sky-300 bg-sky-50 p-4 text-sm text-sky-950 dark:bg-sky-500/10 dark:text-sky-100"
        data-testid="arrived-banner"
      >
        <p className="flex items-center gap-2 font-semibold">
          <LogIn className="size-5" aria-hidden /> {r.toFacility.name} đã tiếp nhận bệnh nhân
        </p>
        <p>
          Bàn giao lúc {r.arrivedAt && formatDateTime(r.arrivedAt)}
          {r.receivedBy && ` · ${r.receivedBy.name}`}
        </p>
        {r.continuationRecord && canRespond && (
          <Button className="self-start" asChild>
            <Link href={`/province/encounters/${r.continuationRecord.id}`}>
              <FileText /> Hồ sơ điều trị tiếp nối {r.continuationRecord.code}
              {r.continuationRecord.status === 'FINALIZED' ? ' (đã ký)' : ''}
            </Link>
          </Button>
        )}
      </section>
    );

  if (r.status === 'REJECTED')
    return (
      <section className="flex flex-col gap-2 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-950 dark:bg-red-500/10 dark:text-red-100">
        <p className="flex items-center gap-2 font-semibold">
          <XCircle className="size-5" aria-hidden /> {r.toFacility.name} không thể tiếp nhận
        </p>
        <p>
          {r.rejectionReason}{' '}
          {r.acceptedBy &&
            `— ${r.acceptedBy.name}, ${r.acceptedAt && formatDateTime(r.acceptedAt)}`}
        </p>
        {!canRespond && (
          <Button variant="destructive" className="self-start" asChild>
            <Link href={`/${portal}/referrals/new?record=${r.sourceRecord.id}`}>
              <Ambulance /> Chuyển tới bệnh viện khác
            </Link>
          </Button>
        )}
      </section>
    );
  return null;
}
