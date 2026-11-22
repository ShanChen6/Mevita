'use client';

import { useEffect, useState } from 'react';
import { CloudOff, Send, Wifi } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { consciousnessLevel, type ConsciousnessLevel } from '@/lib/labels';
import { cn } from '@/lib/utils';

const fields = [
  { id: 'pulse', label: 'Mạch', unit: 'l/p' },
  { id: 'bp', label: 'Huyết áp', unit: 'mmHg' },
  { id: 'spo2', label: 'SpO2', unit: '%' },
  { id: 'gcs', label: 'Glasgow', unit: '3–15' },
] as const;

const levels = Object.keys(consciousnessLevel) as ConsciousnessLevel[];

interface Entry {
  time: string;
  summary: string;
  synced: boolean;
}

/**
 * Wireframe form cập nhật sinh tồn trên xe.
 * Task 4.3: gửi qua Socket.io (`vital_update`), lưu tạm localStorage khi mất sóng và tự đồng bộ lại.
 */
export function EscortVitalsForm() {
  const [online, setOnline] = useState(true);
  const [level, setLevel] = useState<ConsciousnessLevel>('VOICE');
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const time = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(
      new Date(),
    );
    setEntries((prev) => [
      {
        time,
        summary: `M ${data.get('pulse') || '–'} · HA ${data.get('bp') || '–'} · SpO2 ${data.get('spo2') || '–'}% · GCS ${data.get('gcs') || '–'} · ${level}`,
        synced: navigator.onLine,
      },
      ...prev,
    ]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium',
          online
            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200'
            : 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200',
        )}
        role="status"
      >
        {online ? (
          <Wifi className="size-4" aria-hidden />
        ) : (
          <CloudOff className="size-4" aria-hidden />
        )}
        {online
          ? 'Đang kết nối — dữ liệu gửi ngay lên bệnh viện'
          : 'Mất sóng — dữ liệu được lưu tạm và tự gửi khi có mạng'}
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          {fields.map((f) => (
            <div key={f.id} className="flex flex-col gap-1.5">
              <Label htmlFor={f.id}>
                {f.label} <span className="text-muted-foreground font-normal">({f.unit})</span>
              </Label>
              <Input
                id={f.id}
                name={f.id}
                inputMode={f.id === 'bp' ? 'text' : 'numeric'}
                placeholder={f.id === 'bp' ? '120/80' : undefined}
                className="h-14 text-center text-2xl font-semibold tabular-nums"
              />
            </div>
          ))}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Tri giác (AVPU)</legend>
          <div className="grid grid-cols-4 gap-2">
            {levels.map((l) => (
              <Button
                key={l}
                type="button"
                variant={level === l ? 'default' : 'outline'}
                className="h-12 text-lg font-bold"
                onClick={() => setLevel(l)}
                aria-pressed={level === l}
                title={consciousnessLevel[l]}
              >
                {l[0]}
              </Button>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">{consciousnessLevel[level]}</p>
        </fieldset>

        <Button type="submit" size="lg" className="h-14 text-base">
          <Send /> Gửi chỉ số
        </Button>
      </form>

      {entries.length > 0 && (
        <ul className="flex flex-col gap-2 text-sm">
          {entries.map((e, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
            >
              <span>
                <span className="font-mono tabular-nums">{e.time}</span> · {e.summary}
              </span>
              <span className={cn('text-xs', e.synced ? 'text-emerald-600' : 'text-amber-600')}>
                {e.synced ? 'Đã gửi' : 'Chờ đồng bộ'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
