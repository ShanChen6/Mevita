import { cn } from '@/lib/utils';

export interface BarItem {
  key: string;
  label: React.ReactNode;
  /** Giá trị quyết định độ dài thanh */
  value: number;
  /** Nhãn hiển thị cạnh thanh (mặc định = value) */
  display?: string;
  /** Mô tả thêm khi rê chuột / đọc màn hình */
  title?: string;
  highlight?: boolean;
}

/**
 * Thanh ngang xếp hạng (HTML) — một chuỗi một màu, nhãn trực tiếp ở cuối thanh, rê chuột xem chi tiết.
 * Thanh đầu mốc 0, bo 4px ở đầu dữ liệu.
 */
export function BarList({
  items,
  max,
  ariaLabel,
}: {
  items: BarItem[];
  max?: number;
  ariaLabel: string;
}) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="flex flex-col gap-2" aria-label={ariaLabel}>
      {items.map((i) => (
        <li
          key={i.key}
          className="group grid grid-cols-[minmax(0,11rem)_1fr] items-center gap-3 text-sm sm:grid-cols-[minmax(0,14rem)_1fr]"
          title={i.title}
        >
          <span className="truncate">{i.label}</span>
          <span className="flex items-center gap-2">
            <span className="bg-muted/60 relative h-5 flex-1 rounded-r-[4px]">
              <span
                className={cn(
                  'absolute inset-y-0 left-0 rounded-r-[4px] transition-opacity group-hover:opacity-80',
                  i.highlight ? 'bg-[var(--series-2)]' : 'bg-[var(--series-1)]',
                )}
                style={{ width: `${Math.max(1, (i.value / top) * 100)}%` }}
              />
            </span>
            <span className="w-14 text-right font-medium tabular-nums">
              {i.display ?? i.value.toLocaleString('vi-VN')}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
