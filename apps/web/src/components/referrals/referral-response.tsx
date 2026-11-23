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
  XCircle,
  Route,
  Shuffle,
} from 'lucide-react';

import { FormError } from '@/components/auth/form-message';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  acceptReferral,
  arriveReferral,
  rejectReferral,
  updatePreparation,
} from '@/lib/actions/referrals';
import type { Referral } from '@/lib/data/types';
import { formatDateTime } from '@/lib/format';
import { redirectCategory } from '@/lib/labels';

const PRESETS = [
  'Đã chuẩn bị phòng mổ',
  'Dự trù 2 đơn vị máu',
  'Hồi sức cấp cứu sẵn sàng',
  'Đã báo kíp phẫu thuật thần kinh',
  'Chụp CT ngay khi tới',
];

/** Ca thường: đề nghị chuyển sang cơ sở khác — bắt buộc lý do chuyên môn và cơ sở đề xuất (Task B). */
function RedirectDialog({
  id,
  options,
}: {
  id: string;
  options: { id: string; name: string; note: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('');
  const [target, setTarget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button variant="outline">
          <Shuffle /> Đề nghị chuyển nơi khác
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content className="bg-background fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border p-6 shadow-lg">
          <DialogPrimitive.Title className="text-lg font-semibold">
            Đề nghị chuyển ca thường
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-muted-foreground text-sm">
            Chỉ áp dụng cho ca thường, khi bệnh viện không phù hợp về chuyên môn. Quá tải không phải
            lý do hợp lệ — tuyến dưới nhận đề xuất cơ sở cụ thể và chuyển ngay.
          </DialogPrimitive.Description>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await rejectReferral(id, {
                  reason,
                  category,
                  redirectFacilityId: target,
                });
                if (!res.ok) return setError(res.message);
                setOpen(false);
              });
            }}
          >
            <Label htmlFor="redirect-category">Lý do chuyên môn</Label>
            <NativeSelect
              id="redirect-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">— Chọn —</option>
              {Object.entries(redirectCategory).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </NativeSelect>
            <Label htmlFor="redirect-target">Cơ sở đề xuất</Label>
            <NativeSelect
              id="redirect-target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="">— Chọn cơ sở phù hợp —</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} · {o.note}
                </option>
              ))}
            </NativeSelect>
            <Label htmlFor="redirect-reason">Giải thích</Label>
            <Textarea
              id="redirect-reason"
              rows={3}
              value={reason}
              placeholder="VD: Bệnh viện chưa triển khai can thiệp mạch vành, BV X có phòng DSA"
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
                disabled={pending || reason.trim().length < 5 || !category || !target}
              >
                {pending && <Loader2 className="animate-spin" />} Gửi đề nghị
              </Button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Ca cấp cứu thiếu chuyên khoa/thiết bị: vẫn tiếp nhận, sơ cứu ổn định rồi chuyển tiếp (không từ chối). */
function ForwardDialog({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button variant="outline">
          <Route /> Tiếp nhận – ổn định – chuyển tiếp
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content className="bg-background fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border p-6 shadow-lg">
          <DialogPrimitive.Title className="text-lg font-semibold">
            Tiếp nhận để ổn định rồi chuyển tiếp
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-muted-foreground text-sm">
            Ca cấp cứu không được từ chối. Bệnh viện tiếp nhận, sơ cứu ổn định, sau đó lập lệnh
            chuyển tiếp lên tuyến phù hợp từ hồ sơ điều trị. Tuyến dưới được báo kế hoạch này.
          </DialogPrimitive.Description>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await acceptReferral(id, '', { forwardNote: plan });
                if (!res.ok) return setError(res.message);
                setOpen(false);
              });
            }}
          >
            <Label htmlFor="forward-plan">Kế hoạch ổn định & chuyển tiếp</Label>
            <Textarea
              id="forward-plan"
              rows={3}
              value={plan}
              placeholder="VD: Không có phẫu thuật thần kinh — đặt nội khí quản, chụp CT rồi chuyển BV Việt Đức"
              onChange={(e) => setPlan(e.target.value)}
            />
            <FormError message={error ?? undefined} />
            <div className="flex justify-end gap-2">
              <DialogPrimitive.Close asChild>
                <Button type="button" variant="ghost">
                  Đóng
                </Button>
              </DialogPrimitive.Close>
              <Button type="submit" disabled={pending || plan.trim().length < 10}>
                {pending && <Loader2 className="animate-spin" />} Xác nhận tiếp nhận
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
  redirectOptions = [],
}: {
  referral: Referral;
  canRespond: boolean;
  portal: string;
  /** Cơ sở có thể đề xuất khi đề nghị chuyển ca thường */
  redirectOptions?: { id: string; name: string; note: string }[];
}) {
  const [editing, setEditing] = useState(false);

  if (r.status === 'PENDING') {
    if (!canRespond)
      return (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <Clock className="size-4 shrink-0" aria-hidden /> Đang chờ {r.toFacility.name} xác nhận
          tiếp nhận.
          {r.escalationLevel > 0 && (
            <span className="font-medium" data-testid="escalation-note">
              {r.escalationLevel >= 2
                ? ' Đã báo điều phối viên Sở Y tế.'
                : ' Hệ thống đã nhắc lại kíp trực.'}{' '}
              Gọi {r.toFacility.emergencyPhone ?? r.toFacility.phone ?? 'đường dây nóng'}.
            </span>
          )}
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
        {r.escalationLevel > 0 && (
          <p
            className="text-sm font-medium text-red-700 dark:text-red-300"
            data-testid="escalation-note"
          >
            Ca đã chờ quá lâu — hệ thống đã nhắc lại kíp trực
            {r.escalationLevel >= 2 ? ' và báo điều phối viên Sở Y tế' : ''}.
          </p>
        )}
        <NoteEditor
          initial=""
          submitLabel="Xác nhận tiếp nhận & Sẵn sàng ê-kíp"
          onSubmit={async (note) => {
            const res = await acceptReferral(r.id, note);
            return res.ok ? null : res.message;
          }}
        />
        <div className="flex flex-wrap gap-2">
          {r.priority === 'ROUTINE' ? (
            <RedirectDialog
              id={r.id}
              options={redirectOptions.filter((o) => o.id !== r.fromFacility.id)}
            />
          ) : (
            <ForwardDialog id={r.id} />
          )}
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
          <CheckCheck className="size-5" aria-hidden /> {r.toFacility.name}{' '}
          {r.acceptanceType === 'STABILIZE_FORWARD'
            ? 'đã tiếp nhận để sơ cứu, ổn định rồi chuyển tiếp'
            : 'đã tiếp nhận & sẵn sàng ê-kíp'}
        </p>
        {r.acceptanceType === 'STABILIZE_FORWARD' && r.forwardNote && (
          <p
            className="rounded-md bg-amber-100 px-3 py-2 text-amber-950 dark:bg-amber-500/15 dark:text-amber-100"
            data-testid="forward-note"
          >
            <span className="font-medium">Kế hoạch chuyển tiếp: </span>
            {r.forwardNote}
          </p>
        )}
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
          <XCircle className="size-5" aria-hidden /> {r.toFacility.name} đề nghị chuyển sang cơ sở
          khác
        </p>
        <p data-testid="redirect-info">
          {r.redirectCategory && (
            <span className="font-medium">{redirectCategory[r.redirectCategory]}: </span>
          )}
          {r.rejectionReason}{' '}
          {r.acceptedBy &&
            `— ${r.acceptedBy.name}, ${r.acceptedAt && formatDateTime(r.acceptedAt)}`}
        </p>
        {r.redirectFacility && (
          <p>
            Cơ sở đề xuất: <span className="font-semibold">{r.redirectFacility.name}</span>
          </p>
        )}
        {!canRespond && (
          <div className="flex flex-wrap gap-2">
            {r.redirectFacility && (
              <Button variant="destructive" asChild>
                <Link
                  href={`/${portal}/referrals/new?record=${r.sourceRecord.id}&to=${r.redirectFacility.id}`}
                >
                  <Ambulance /> Chuyển tới {r.redirectFacility.name}
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href={`/${portal}/referrals/new?record=${r.sourceRecord.id}`}>
                Chọn bệnh viện khác
              </Link>
            </Button>
          </div>
        )}
      </section>
    );
  return null;
}
