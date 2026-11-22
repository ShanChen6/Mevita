'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';

import { loadMoreRecords } from '@/app/(patient)/patient/records/actions';
import { Button } from '@/components/ui/button';
import type { MedicalRecordItem, Page } from '@/lib/data/types';
import { RecordCard } from './record-card';

/** Dòng thời gian các lần khám, tải thêm theo trang. */
export function RecordTimeline({ initial }: { initial: Page<MedicalRecordItem> }) {
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const loadMore = () =>
    startTransition(async () => {
      if (!cursor) return;
      const res = await loadMoreRecords(cursor);
      if ('error' in res) return setError(res.error);
      setError(null);
      setItems((prev) => [...prev, ...res.items]);
      setCursor(res.nextCursor);
    });

  return (
    <div className="flex flex-col gap-6">
      <ol className="relative flex flex-col gap-6 border-l pl-6 sm:ml-3">
        {items.map((r) => (
          <li key={r.id} className="relative">
            <span
              aria-hidden
              className="border-background bg-primary ring-primary/30 absolute -left-[31px] top-6 size-3 rounded-full border-2 ring-2"
            />
            <RecordCard record={r} />
          </li>
        ))}
      </ol>
      {error && <p className="text-destructive text-center text-sm">{error}</p>}
      {cursor && (
        <Button variant="outline" className="self-center" onClick={loadMore} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Xem thêm lần khám cũ hơn
        </Button>
      )}
    </div>
  );
}
