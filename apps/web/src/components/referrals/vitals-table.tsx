import type { VitalLog } from '@/lib/data/types';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Ngưỡng cảnh báo đơn giản cho người lớn — tô đỏ để bác sĩ tuyến trên chú ý. */
export const abnormal = {
  pulse: (v: number) => v < 50 || v > 120,
  systolicBp: (v: number) => v < 90 || v > 180,
  spo2: (v: number) => v < 94,
  respiratoryRate: (v: number) => v < 10 || v > 28,
  gcs: (v: number) => v <= 8,
};

const Cell = ({
  value,
  bad,
  suffix = '',
}: {
  value: number | null;
  bad?: (v: number) => boolean;
  suffix?: string;
}) => (
  <td
    className={cn(
      'px-2 py-1.5 tabular-nums',
      value != null && bad?.(value) && 'font-semibold text-red-600 dark:text-red-400',
    )}
  >
    {value ?? '–'}
    {value != null && suffix}
  </td>
);

/** Nhật ký sinh tồn trên xe (mới nhất trước). `pending` = bản chưa đồng bộ lên máy chủ. */
export function VitalsTable({ rows, pendingIds }: { rows: VitalLog[]; pendingIds?: Set<string> }) {
  if (rows.length === 0)
    return <p className="text-muted-foreground text-sm">Chưa có lần đo nào trên xe.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-muted-foreground text-left text-xs">
          <tr>
            <th className="px-2 py-1 font-medium">Giờ</th>
            <th className="px-2 py-1 font-medium">Mạch</th>
            <th className="px-2 py-1 font-medium">HA</th>
            <th className="px-2 py-1 font-medium">SpO2</th>
            <th className="px-2 py-1 font-medium">NT</th>
            <th className="px-2 py-1 font-medium">GCS</th>
            <th className="px-2 py-1 font-medium">AVPU</th>
          </tr>
        </thead>
        <tbody>
          {[...rows].reverse().map((v) => (
            <tr key={v.clientId} className="border-t" data-testid="vital-row">
              <td className="px-2 py-1.5 font-mono tabular-nums">
                {formatTime(v.recordedAt)}
                {pendingIds?.has(v.clientId) && (
                  <span className="ml-1 rounded bg-amber-100 px-1 font-sans text-[10px] text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
                    chờ gửi
                  </span>
                )}
              </td>
              <Cell value={v.pulse} bad={abnormal.pulse} />
              <td
                className={cn(
                  'px-2 py-1.5 tabular-nums',
                  v.systolicBp != null &&
                    abnormal.systolicBp(v.systolicBp) &&
                    'font-semibold text-red-600 dark:text-red-400',
                )}
              >
                {v.systolicBp != null ? `${v.systolicBp}/${v.diastolicBp}` : '–'}
              </td>
              <Cell value={v.spo2} bad={abnormal.spo2} suffix="%" />
              <Cell value={v.respiratoryRate} bad={abnormal.respiratoryRate} />
              <Cell value={v.gcs} bad={abnormal.gcs} />
              <td className="px-2 py-1.5">{v.consciousness?.[0] ?? '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
