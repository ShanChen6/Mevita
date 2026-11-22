import Link from 'next/link';
import { HeartPulse } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AuthCardProps {
  title: string;
  description: string;
  wide?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function AuthCard({ title, description, wide, footer, children }: AuthCardProps) {
  return (
    <main className="bg-muted/40 flex min-h-svh items-center justify-center px-4 py-10">
      <div className={cn('flex w-full flex-col gap-6', wide ? 'max-w-xl' : 'max-w-sm')}>
        <Link href="/" className="flex items-center justify-center gap-2 font-bold">
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
            <HeartPulse className="size-4" aria-hidden />
          </span>
          Mevita
        </Link>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
        {footer}
      </div>
    </main>
  );
}
