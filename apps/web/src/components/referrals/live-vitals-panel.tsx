'use client';

import { Activity } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { VitalLog } from '@/lib/data/types';
import { formatTime } from '@/lib/format';
import { consciousnessLevel } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { useLiveVitals } from './use-live-vitals';
import { VitalsChart } from './vitals-chart';
import { abnormal, VitalsTable } from './vitals-table';

/** Diễn biến sinh tồn trên xe — cập nhật tức thì khi nhân viên đi kèm gửi chỉ số (`vital_update`). */
export function LiveVitalsPanel({
  referralId,
  initial,
  escort,
}: {
  referralId: string;
  initial: VitalLog[];
  escort: string | null;
}) {
  const vitals = useLiveVitals(referralId, initial);
  const last = vitals.at(-1);
  // Giá trị gần nhất đã đo của từng chỉ số (lần đo sau có thể không đo đủ)
  const latest = <K extends 'pulse' | 'systolicBp' | 'spo2' | 'gcs'>(k: K) =>
    vitals.findLast((v) => v[k] != null);
  const bp = latest('systolicBp');
  const pulse = latest('pulse')?.pulse ?? null;
  const spo2 = latest('spo2')?.spo2 ?? null;
  const gcs = latest('gcs')?.gcs ?? null;
  const tiles = last
    ? [
        { k: 'Mạch', v: pulse, bad: pulse != null && abnormal.pulse(pulse) },
        {
          k: 'Huyết áp',
          v: bp ? `${bp.systolicBp}/${bp.diastolicBp}` : null,
          bad: !!bp?.systolicBp && abnormal.systolicBp(bp.systolicBp),
        },
        {
          k: 'SpO2',
          v: spo2 != null ? `${spo2}%` : null,
          bad: spo2 != null && abnormal.spo2(spo2),
        },
        { k: 'Glasgow', v: gcs, bad: gcs != null && abnormal.gcs(gcs) },
      ]
    : [];
  return (
    <Card data-testid="live-vitals">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-4 text-red-500" aria-hidden /> Diễn biến sinh tồn trên xe
        </CardTitle>
        <CardDescription>
          {last
            ? `Cập nhật lần cuối ${formatTime(last.recordedAt)} bởi ${last.recordedBy}${
                last.consciousness ? ` · ${consciousnessLevel[last.consciousness]}` : ''
              }`
            : `Chưa có chỉ số — ${escort ?? 'nhân viên đi kèm'} cập nhật từ điện thoại trên xe.`}
        </CardDescription>
      </CardHeader>
      {last && (
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-live="polite">
            {tiles.map((t) => (
              <div
                key={t.k}
                className={cn(
                  'rounded-md px-3 py-2',
                  t.bad
                    ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
                    : 'bg-muted',
                )}
              >
                <p className="text-xs opacity-80">{t.k}</p>
                <p className="text-xl font-semibold tabular-nums" data-testid={`latest-${t.k}`}>
                  {t.v ?? '–'}
                </p>
              </div>
            ))}
          </div>
          {last.note && (
            <p className="text-sm">
              <span className="text-muted-foreground">Ghi chú: </span>
              {last.note}
            </p>
          )}
          {vitals.length > 1 && <VitalsChart data={vitals} />}
          <VitalsTable rows={vitals} />
        </CardContent>
      )}
    </Card>
  );
}
