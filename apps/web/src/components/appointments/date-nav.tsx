'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { addDaysStr } from '@/lib/format';
import { appointmentStatus, type AppointmentStatus } from '@/lib/labels';

/** Chọn ngày & lọc trạng thái — lưu trên URL (?date=&status=) để chia sẻ/tải lại được. */
export function AppointmentFilters({ date, today }: { date: string; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const go = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.push(`${pathname}?${next}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          aria-label="Ngày trước"
          onClick={() => go({ date: addDaysStr(date, -1) })}
        >
          <ChevronLeft />
        </Button>
        <Input
          type="date"
          aria-label="Ngày"
          value={date}
          onChange={(e) => e.target.value && go({ date: e.target.value })}
          className="w-40"
        />
        <Button
          variant="outline"
          size="icon"
          aria-label="Ngày sau"
          onClick={() => go({ date: addDaysStr(date, 1) })}
        >
          <ChevronRight />
        </Button>
        {date !== today && (
          <Button variant="ghost" size="sm" onClick={() => go({ date: today })}>
            Hôm nay
          </Button>
        )}
      </div>
      <div className="w-44">
        <NativeSelect
          aria-label="Trạng thái"
          value={params.get('status') ?? ''}
          onChange={(e) => go({ status: e.target.value })}
        >
          <option value="">Tất cả trạng thái</option>
          {(Object.keys(appointmentStatus) as AppointmentStatus[]).map((s) => (
            <option key={s} value={s}>
              {appointmentStatus[s].label}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}
