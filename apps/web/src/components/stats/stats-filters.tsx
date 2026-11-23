'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Loader2 } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { cn } from '@/lib/utils';

const PRESETS = [
  { days: 7, label: '7 ngày' },
  { days: 30, label: '30 ngày' },
  { days: 90, label: '90 ngày' },
  { days: 180, label: '6 tháng' },
  { days: 365, label: '12 tháng' },
];

/** Bộ lọc thống kê: khoảng thời gian (nhanh hoặc tuỳ chọn) và tỉnh/thành — một hàng phía trên biểu đồ. */
export function StatsFilters({
  provinces,
  from,
  to,
  province,
  preset,
}: {
  provinces: { code: string; name: string }[];
  from: string;
  to: string;
  province: string;
  preset: number | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    start(() => router.replace(`${pathname}?${next}`, { scroll: false }));
  };

  return (
    <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Bộ lọc thống kê">
      <div className="bg-muted flex rounded-lg p-1" role="radiogroup" aria-label="Khoảng thời gian">
        {PRESETS.map((p) => (
          <button
            key={p.days}
            type="button"
            role="radio"
            aria-checked={preset === p.days}
            onClick={() => update({ days: String(p.days), from: null, to: null })}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              preset === p.days
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Từ ngày
        <Input
          type="date"
          value={from}
          max={to}
          className="h-9 w-40"
          onChange={(e) => e.target.value && update({ from: e.target.value, to, days: null })}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Đến ngày
        <Input
          type="date"
          value={to}
          min={from}
          className="h-9 w-40"
          onChange={(e) => e.target.value && update({ from, to: e.target.value, days: null })}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Tỉnh / thành
        <NativeSelect
          value={province}
          className="h-9 w-48"
          onChange={(e) => update({ province: e.target.value || null })}
          aria-label="Tỉnh / thành"
        >
          <option value="">Toàn quốc</option>
          {provinces.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </NativeSelect>
      </label>
      {pending && (
        <Loader2 className="text-muted-foreground mb-2 size-4 animate-spin" aria-label="Đang tải" />
      )}
    </div>
  );
}
