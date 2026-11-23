'use client';

import { useState, useTransition } from 'react';
import { BedDouble, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';

import { FormError } from '@/components/auth/form-message';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateCapacity } from '@/lib/actions/referrals';
import type { FacilityCapacity } from '@/lib/data/types';
import { formatDateTime } from '@/lib/format';
import { loadLevel } from '@/lib/labels';
import { cn } from '@/lib/utils';

const num = (v: string) => (v.trim() === '' ? NaN : Number(v));

/**
 * Năng lực tiếp nhận của bệnh viện (Task B): giường cấp cứu / hồi sức còn trống. Tuyến dưới dùng để chọn
 * bệnh viện phù hợp; quá tải chỉ khiến bệnh viện bị xếp sau trong gợi ý, không phải lý do từ chối.
 */
export function CapacityCard({ capacity: c }: { capacity: FacilityCapacity }) {
  const [editing, setEditing] = useState(c.load === 'UNKNOWN');
  const [v, setV] = useState({
    total: c.erBedsTotal?.toString() ?? '',
    available: c.erBedsAvailable?.toString() ?? '',
    icu: c.icuBedsAvailable?.toString() ?? '',
    note: c.capacityNote ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((x) => ({ ...x, [k]: e.target.value }));
  const step = (d: number) =>
    setV((x) => ({
      ...x,
      available: String(Math.max(0, Math.min(num(x.total) || 0, (num(x.available) || 0) + d))),
    }));

  return (
    <Card
      data-testid="capacity-card"
      className={cn(c.load === 'RED' && 'border-red-300 dark:border-red-500/40')}
    >
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <BedDouble className="size-4" aria-hidden /> Năng lực tiếp nhận
          <Badge
            className={cn('border-transparent', loadLevel[c.load].className)}
            data-testid="capacity-load"
          >
            {loadLevel[c.load].label}
          </Badge>
        </CardTitle>
        <CardDescription>
          {c.capacityUpdatedAt
            ? `Cập nhật ${formatDateTime(c.capacityUpdatedAt)}`
            : 'Chưa cập nhật'}
          {c.capacityStale &&
            c.capacityUpdatedAt &&
            ' — số liệu đã cũ, tuyến dưới thấy "số liệu cũ"'}
        </CardDescription>
        {!editing && (
          <CardAction>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil /> Cập nhật
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {!editing ? (
          <div className="flex flex-wrap gap-6 text-sm">
            <p>
              <span className="text-2xl font-bold tabular-nums">{c.erBedsAvailable ?? '—'}</span>
              <span className="text-muted-foreground">
                /{c.erBedsTotal ?? '—'} giường cấp cứu trống
              </span>
            </p>
            <p>
              <span className="text-2xl font-bold tabular-nums">{c.icuBedsAvailable ?? '—'}</span>
              <span className="text-muted-foreground"> giường hồi sức trống</span>
            </p>
            {c.capacityNote && <p className="text-muted-foreground basis-full">{c.capacityNote}</p>}
          </div>
        ) : (
          <form
            className="grid gap-3 sm:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await updateCapacity({
                  erBedsTotal: num(v.total),
                  erBedsAvailable: num(v.available),
                  icuBedsAvailable: v.icu.trim() === '' ? null : num(v.icu),
                  capacityNote: v.note,
                });
                if (!res.ok) return setError(res.message);
                setError(null);
                setEditing(false);
                toast.success('Đã cập nhật năng lực tiếp nhận');
              });
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="erBedsTotal">Tổng giường cấp cứu</Label>
              <Input id="erBedsTotal" inputMode="numeric" value={v.total} onChange={set('total')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="erBedsAvailable">Đang trống</Label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => step(-1)}
                  aria-label="Bớt 1"
                >
                  −
                </Button>
                <Input
                  id="erBedsAvailable"
                  inputMode="numeric"
                  className="text-center"
                  value={v.available}
                  onChange={set('available')}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => step(1)}
                  aria-label="Thêm 1"
                >
                  +
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="icuBedsAvailable">Giường hồi sức trống</Label>
              <Input
                id="icuBedsAvailable"
                inputMode="numeric"
                value={v.icu}
                onChange={set('icu')}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="capacityNote">Ghi chú</Label>
              <Input
                id="capacityNote"
                placeholder="VD: Đang có tai nạn hàng loạt"
                value={v.note}
                onChange={set('note')}
              />
            </div>
            <div className="flex items-center gap-3 sm:col-span-4">
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />} Lưu
              </Button>
              {c.load !== 'UNKNOWN' && (
                <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                  Huỷ
                </Button>
              )}
              <FormError message={error ?? undefined} />
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
