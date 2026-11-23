'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CloudOff, Loader2, RefreshCw, Send, Trash2, Wifi } from 'lucide-react';

import { useRealtime } from '@/components/realtime/realtime-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ConsciousnessValue, VitalEntry, VitalLog } from '@/lib/data/types';
import { consciousnessLevel } from '@/lib/labels';
import { cn } from '@/lib/utils';
import {
  discard,
  emptyQueue,
  enqueue,
  markFailed,
  readQueue,
  removeAccepted,
  subscribeQueue,
} from '@/lib/vitals-queue';
import { useLiveVitals } from './use-live-vitals';
import { VitalsTable } from './vitals-table';

type Ack =
  | { ok: true; accepted: string[]; created: number }
  | { ok: false; message: string; retry: boolean };

const LEVELS: ConsciousnessValue[] = ['ALERT', 'VOICE', 'PAIN', 'UNRESPONSIVE'];
const NUM = [
  { id: 'pulse', label: 'Mạch', unit: 'l/p', min: 20, max: 250 },
  { id: 'bp', label: 'Huyết áp', unit: 'mmHg' },
  { id: 'spo2', label: 'SpO2', unit: '%', min: 50, max: 100 },
  { id: 'respiratoryRate', label: 'Nhịp thở', unit: 'l/p', min: 4, max: 80 },
  { id: 'gcs', label: 'Glasgow', unit: '3–15', min: 3, max: 15 },
] as const;

const subscribeOnline = (cb: () => void) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};

/** Đọc form → bản ghi; trả chuỗi lỗi nếu dữ liệu sai. */
function parse(data: FormData, consciousness: ConsciousnessValue | null): VitalEntry | string {
  const num = (k: string) => {
    const raw = String(data.get(k) ?? '')
      .trim()
      .replace(',', '.');
    return raw === '' ? null : Number(raw);
  };
  const entry: VitalEntry = {
    clientId: crypto.randomUUID(),
    recordedAt: new Date().toISOString(),
    pulse: num('pulse'),
    systolicBp: null,
    diastolicBp: null,
    spo2: num('spo2'),
    respiratoryRate: num('respiratoryRate'),
    temperature: null,
    consciousness,
    gcs: num('gcs'),
    note: String(data.get('note') ?? '').trim() || null,
  };
  const bp = String(data.get('bp') ?? '').trim();
  if (bp) {
    const m = /^(\d{2,3})\s*[/\s-]\s*(\d{2,3})$/.exec(bp);
    if (!m) return 'Huyết áp nhập dạng 120/80';
    entry.systolicBp = Number(m[1]);
    entry.diastolicBp = Number(m[2]);
    if (entry.systolicBp <= entry.diastolicBp) return 'HA tâm thu phải lớn hơn tâm trương';
  }
  for (const f of NUM) {
    if (!('min' in f)) continue;
    const v = entry[f.id];
    if (v != null && (!Number.isInteger(v) || v < f.min || v > f.max))
      return `${f.label} phải là số nguyên từ ${f.min} đến ${f.max}`;
  }
  const any = [
    entry.pulse,
    entry.systolicBp,
    entry.spo2,
    entry.respiratoryRate,
    entry.gcs,
    entry.consciousness,
  ].some((v) => v != null);
  if (!any && !entry.note) return 'Nhập ít nhất một chỉ số';
  return entry;
}

/**
 * Cập nhật sinh tồn trên xe (Task 4.3). Mỗi lần đo được ghi vào hàng đợi localStorage trước, rồi gửi qua
 * Socket.io (`vital_update` có ack). Mất sóng: giữ trong hàng đợi và tự gửi lại khi socket kết nối lại,
 * khi trình duyệt báo có mạng, hoặc mỗi 10 giây. Máy chủ bỏ qua bản trùng theo `clientId`.
 */
export function EscortVitalsForm({
  referralId,
  initial,
}: {
  referralId: string;
  initial: VitalLog[];
}) {
  const { socket, status } = useRealtime();
  const queue = useSyncExternalStore(subscribeQueue, () => readQueue(referralId), emptyQueue);
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const synced = useLiveVitals(referralId, initial);
  const [level, setLevel] = useState<ConsciousnessValue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const flushing = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const connected = status === 'connected' && online;
  const pending = queue.filter((e) => !e.error);
  const failed = queue.filter((e) => e.error);

  const flush = useCallback(() => {
    const batch = readQueue(referralId)
      .filter((e) => !e.error)
      .slice(0, 100);
    if (!socket?.connected || !navigator.onLine || flushing.current || batch.length === 0) return;
    flushing.current = true;
    setSending(true);
    const entries = batch; // bản lỗi đã bị lọc nên không có trường `error`
    socket
      .timeout(8000)
      .emit('vital_update', { referralId, entries }, (err: Error | null, ack?: Ack) => {
        flushing.current = false;
        setSending(false);
        if (err || !ack) return; // hết thời gian chờ — giữ nguyên hàng đợi, thử lại sau
        if (ack.ok) {
          removeAccepted(referralId, ack.accepted);
        } else if (!ack.retry) {
          markFailed(
            referralId,
            entries.map((e) => e.clientId),
            ack.message,
          );
        }
      });
  }, [socket, referralId]);

  useEffect(() => {
    if (!socket) return;
    socket.on('connect', flush);
    window.addEventListener('online', flush);
    const timer = setInterval(flush, 10_000);
    const first = setTimeout(flush, 0); // gửi bản còn tồn từ lần mở trước
    return () => {
      socket.off('connect', flush);
      window.removeEventListener('online', flush);
      clearInterval(timer);
      clearTimeout(first);
    };
  }, [socket, flush]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const entry = parse(new FormData(event.currentTarget), level);
    if (typeof entry === 'string') return setError(entry);
    setError(null);
    enqueue(referralId, entry);
    formRef.current?.reset();
    setLevel(null);
    flush();
  }

  // Bản đã lưu ở máy chủ + bản còn trong hàng đợi (hiện ngay trên máy, gắn nhãn "chờ gửi")
  const syncedIds = new Set(synced.map((v) => v.clientId));
  const local = pending
    .filter((e) => !syncedIds.has(e.clientId))
    .map((e) => ({ ...e, id: e.clientId, receivedAt: e.recordedAt, recordedBy: 'Thiết bị này' }));
  const rows = [...synced, ...local].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium',
          connected
            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200'
            : 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200',
        )}
        role="status"
        data-testid="sync-status"
      >
        {connected ? (
          <Wifi className="size-4 shrink-0" aria-hidden />
        ) : (
          <CloudOff className="size-4 shrink-0" aria-hidden />
        )}
        <span className="flex-1">
          {connected
            ? pending.length > 0
              ? `Đang gửi ${pending.length} lần đo…`
              : 'Đã kết nối — chỉ số gửi ngay lên bệnh viện'
            : `Mất sóng — ${pending.length} lần đo lưu tạm trên máy, tự gửi khi có mạng`}
        </span>
        {pending.length > 0 && connected && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={flush}
            disabled={sending}
          >
            {sending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            <span className="sr-only">Gửi lại</span>
          </Button>
        )}
      </div>

      <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          {NUM.map((f) => (
            <div
              key={f.id}
              className={cn('flex flex-col gap-1.5', f.id === 'gcs' && 'col-span-2 sm:col-span-1')}
            >
              <Label htmlFor={f.id}>
                {f.label} <span className="text-muted-foreground font-normal">({f.unit})</span>
              </Label>
              <Input
                id={f.id}
                name={f.id}
                inputMode={f.id === 'bp' ? 'text' : 'numeric'}
                autoComplete="off"
                placeholder={f.id === 'bp' ? '120/80' : undefined}
                className="h-14 text-center text-2xl font-semibold tabular-nums"
              />
            </div>
          ))}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Tri giác (AVPU)</legend>
          <div className="grid grid-cols-4 gap-2">
            {LEVELS.map((l) => (
              <Button
                key={l}
                type="button"
                variant={level === l ? 'default' : 'outline'}
                className="h-12 text-lg font-bold"
                onClick={() => setLevel(level === l ? null : l)}
                aria-pressed={level === l}
                aria-label={consciousnessLevel[l]}
              >
                {l[0]}
              </Button>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            {level ? consciousnessLevel[level] : 'Chạm để chọn (tuỳ chọn)'}
          </p>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="note">Ghi chú</Label>
          <Input
            id="note"
            name="note"
            placeholder="VD: nôn 1 lần, đồng tử P > T"
            autoComplete="off"
          />
        </div>

        {error && (
          <p role="alert" className="text-destructive text-sm font-medium">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="h-14 text-base">
          <Send /> Gửi chỉ số
        </Button>
      </form>

      {failed.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Bản ghi bị từ chối">
          {failed.map((e) => (
            <li
              key={e.clientId}
              className="border-destructive/40 bg-destructive/5 flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <span className="flex-1">Không gửi được: {e.error}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Bỏ bản ghi"
                onClick={() => discard(referralId, e.clientId)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-2" aria-labelledby="log-heading">
        <h2 id="log-heading" className="text-sm font-semibold">
          Nhật ký trên xe ({rows.length})
        </h2>
        <VitalsTable rows={rows} pendingIds={new Set(local.map((e) => e.clientId))} />
      </section>
    </div>
  );
}
