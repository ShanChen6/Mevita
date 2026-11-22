'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';

/** Lọc nhanh danh sách đang hiển thị theo mã lịch hẹn, tên, CCCD, BHYT, SĐT. */
export function QuickSearch({ children }: { children: (q: string) => React.ReactNode }) {
  const [q, setQ] = useState('');
  return (
    <>
      <div className="relative sm:w-80">
        <Search
          className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Mã lịch hẹn, tên, CCCD, BHYT…"
          aria-label="Tìm lịch hẹn"
          className="pl-9"
        />
      </div>
      {children(q.trim().toLowerCase())}
    </>
  );
}
