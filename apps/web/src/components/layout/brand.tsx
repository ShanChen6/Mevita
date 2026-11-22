import Link from 'next/link';
import { HeartPulse } from 'lucide-react';

import { cn } from '@/lib/utils';
import { portals, type Portal } from './portals';

export function Brand({ portal }: { portal: Portal }) {
  const config = portals[portal];
  return (
    <Link href={`/${portal}`} className="flex items-center gap-2 px-1 py-1">
      <span
        className={cn(
          'flex size-8 items-center justify-center rounded-lg text-white',
          config.accentClass,
        )}
      >
        <HeartPulse className="size-4" aria-hidden />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-bold">Mevita</span>
        <span className="text-muted-foreground text-xs">{config.name}</span>
      </span>
    </Link>
  );
}
