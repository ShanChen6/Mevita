import { Construction } from 'lucide-react';

/** Ghi chú cho biết màn hình đang dùng dữ liệu mẫu và sẽ được hoàn thiện ở task nào. */
export function WireframeNote({ task, children }: { task: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-dashed border-amber-400/70 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
      <Construction className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <p>
        <span className="font-semibold">Wireframe · dữ liệu mẫu.</span> Chức năng thật ở{' '}
        <span className="font-semibold">Task {task}</span>
        {children ? <>: {children}</> : '.'}
      </p>
    </div>
  );
}
