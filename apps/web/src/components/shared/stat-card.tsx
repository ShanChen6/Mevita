import type { LucideIcon } from 'lucide-react';

import { Card } from '@/components/ui/card';

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
}

export function StatCard({ label, value, hint, icon: Icon }: StatCardProps) {
  return (
    <Card className="gap-2 px-5 py-4">
      <div className="text-muted-foreground flex items-center justify-between text-sm">
        {label}
        <Icon className="size-4" aria-hidden />
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </Card>
  );
}
