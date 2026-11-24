import Image from 'next/image';

import { cn } from '@/lib/utils';

/** Biểu tượng chữ M + nhịp tim của Mevita (nền trong suốt, dùng được trên nền sáng và tối). */
export function LogoMark({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/logo-mark.png"
      alt=""
      aria-hidden
      width={640}
      height={400}
      priority={priority}
      className={cn('h-9 w-auto shrink-0', className)}
    />
  );
}
