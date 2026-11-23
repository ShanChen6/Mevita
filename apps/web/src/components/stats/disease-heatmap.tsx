import type { StatsOverview } from '@/lib/data/types';
import { icdChapter } from '@/lib/labels';

/** Thang tuần tự một màu (xanh, nhạt → đậm) — giá trị càng lớn càng đậm. */
const RAMP = [
  '#cde2fb',
  '#b7d3f6',
  '#9ec5f4',
  '#86b6ef',
  '#6da7ec',
  '#5598e7',
  '#3987e5',
  '#2a78d6',
  '#256abf',
  '#1c5cab',
  '#184f95',
  '#104281',
  '#0d366b',
];

function cell(share: number, max: number) {
  if (share <= 0) return { background: 'transparent', color: 'var(--muted-foreground)' };
  const idx = Math.min(RAMP.length - 1, Math.round((share / max) * (RAMP.length - 1)));
  return { background: RAMP[idx], color: idx >= 6 ? '#ffffff' : '#0b0b0b' };
}

/**
 * Mô hình bệnh tật theo địa phương: tỉ trọng (%) chẩn đoán chính theo chương ICD-10 trong tổng lượt khám
 * của từng tỉnh. Bảng HTML nên đọc được bằng trình đọc màn hình; con số luôn hiện trong ô.
 */
export function DiseaseHeatmap({ data }: { data: StatsOverview['diseasePattern'] }) {
  const max = Math.max(1, ...data.rows.flatMap((r) => r.shares));
  if (data.rows.length === 0)
    return (
      <p className="text-muted-foreground text-sm">Chưa có lượt khám trong khoảng thời gian này.</p>
    );
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table
          className="w-full border-separate border-spacing-0.5 text-sm"
          data-testid="disease-heatmap"
        >
          <thead>
            <tr>
              <th className="text-muted-foreground px-2 py-1 text-left text-xs font-medium">
                Tỉnh / thành
              </th>
              {data.chapters.map((c) => (
                <th
                  key={c}
                  className="text-muted-foreground min-w-20 px-1 py-1 text-center text-xs font-medium"
                  scope="col"
                >
                  {icdChapter[c] ?? c}
                </th>
              ))}
              <th className="text-muted-foreground px-2 py-1 text-right text-xs font-medium">
                Lượt khám
              </th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.province}>
                <th scope="row" className="whitespace-nowrap px-2 py-1 text-left font-medium">
                  {r.name}
                </th>
                {r.shares.map((s, i) => (
                  <td
                    key={data.chapters[i]}
                    className="rounded-[4px] px-1 py-1.5 text-center tabular-nums"
                    style={cell(s, max)}
                    title={`${r.name} — ${icdChapter[data.chapters[i]!] ?? data.chapters[i]}: ${s}% chẩn đoán chính`}
                  >
                    {s > 0 ? `${s.toLocaleString('vi-VN')}%` : '–'}
                  </td>
                ))}
                <td className="px-2 py-1 text-right tabular-nums">
                  {r.total.toLocaleString('vi-VN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-muted-foreground flex items-center gap-2 text-xs" aria-hidden>
        0%
        <span
          className="h-2.5 w-40 rounded-sm"
          style={{ background: `linear-gradient(to right, ${RAMP.join(',')})` }}
        />
        {max.toLocaleString('vi-VN')}%
      </div>
    </div>
  );
}
