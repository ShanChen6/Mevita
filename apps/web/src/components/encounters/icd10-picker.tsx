'use client';

import { useId, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { searchIcd10 } from '@/lib/actions/encounters';
import type { Icd10Option } from '@/lib/data/types';
import { cn } from '@/lib/utils';

interface Props {
  onSelect: (option: Icd10Option) => void;
  /** Mã đã chọn — ẩn khỏi danh sách gợi ý */
  exclude: string[];
  disabled?: boolean;
}

/** Ô tra cứu ICD-10 (combobox): gõ mã hoặc tên có/không dấu, chọn bằng chuột hoặc ↑ ↓ Enter. */
export function Icd10Picker({ onSelect, exclude, disabled }: Props) {
  const listId = useId();
  const [q, setQ] = useState('');
  const [options, setOptions] = useState<Icd10Option[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const visible = options.filter((o) => !exclude.includes(o.code));

  function onChange(value: string) {
    setQ(value);
    if (timer.current) clearTimeout(timer.current);
    if (!value.trim()) {
      setOptions([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      const id = ++seq.current;
      setLoading(true);
      const result = await searchIcd10(value);
      if (id !== seq.current) return;
      setOptions(result);
      setActive(0);
      setOpen(true);
      setLoading(false);
    }, 250);
  }

  function choose(option: Icd10Option) {
    onSelect(option);
    setQ('');
    setOptions([]);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || visible.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % visible.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + visible.length) % visible.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const option = visible[active];
      if (option) choose(option);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <Search
        className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2"
        aria-hidden
      />
      <Input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && visible[active] ? `${listId}-${visible[active].code}` : undefined
        }
        aria-label="Tra cứu mã bệnh ICD-10"
        placeholder="Gõ mã hoặc tên bệnh, VD: I10, tăng huyết áp, viem phoi…"
        value={q}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => visible.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="pl-9"
        autoComplete="off"
      />
      {loading && (
        <Loader2 className="text-muted-foreground absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin" />
      )}
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="bg-popover absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border p-1 shadow-md"
        >
          {visible.length === 0 ? (
            <li className="text-muted-foreground px-3 py-2 text-sm">Không tìm thấy mã phù hợp</li>
          ) : (
            visible.map((o, i) => (
              <li
                key={o.code}
                id={`${listId}-${o.code}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-sm px-3 py-2 text-sm',
                  i === active && 'bg-accent text-accent-foreground',
                )}
              >
                <span className="w-14 shrink-0 font-mono font-semibold">{o.code}</span>
                <span>
                  {o.nameVi}
                  {o.nameEn && (
                    <span className="text-muted-foreground block text-xs">{o.nameEn}</span>
                  )}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
