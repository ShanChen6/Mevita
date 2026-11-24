import Link from 'next/link';

import { LogoMark } from '@/components/brand/logo-mark';
import { portals, type Portal } from './portals';

export function Brand({ portal }: { portal: Portal }) {
  const config = portals[portal];
  return (
    <Link href={`/${portal}`} className="flex items-center gap-2 px-1 py-1">
      <LogoMark className="h-9" priority />
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-bold">Mevita</span>
        <span className="text-muted-foreground text-xs">{config.name}</span>
      </span>
    </Link>
  );
}
