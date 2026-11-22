import type { Metadata } from 'next';
import Link from 'next/link';
import { Ambulance, Building2, HeartPulse, UserRound } from 'lucide-react';

import { Field } from '@/components/shared/field';
import { WireframeNote } from '@/components/shared/wireframe-note';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

export const metadata: Metadata = { title: 'Đăng nhập' };

const demoPortals = [
  { href: '/patient', label: 'Bệnh nhân', icon: UserRound },
  { href: '/commune', label: 'Bác sĩ Tuyến Xã', icon: Ambulance },
  { href: '/province', label: 'Bác sĩ Tuyến Tỉnh', icon: Building2 },
];

export default function LoginPage() {
  return (
    <main className="bg-muted/40 flex min-h-svh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center justify-center gap-2 font-bold">
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
            <HeartPulse className="size-4" aria-hidden />
          </span>
          Mevita
        </Link>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Đăng nhập</CardTitle>
            <CardDescription>Dùng email hoặc số điện thoại đã đăng ký.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4">
              <Field label="Email hoặc số điện thoại" htmlFor="identifier">
                <Input id="identifier" name="identifier" autoComplete="username" required />
              </Field>
              <Field label="Mật khẩu" htmlFor="password">
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </Field>
              <Button type="submit" disabled>
                Đăng nhập
              </Button>
              <p className="text-muted-foreground text-center text-sm">
                Chưa có tài khoản?{' '}
                <span className="text-foreground font-medium">Đăng ký (Task 2.1)</span>
              </p>
            </form>

            <div className="text-muted-foreground my-6 flex items-center gap-3 text-xs">
              <Separator className="flex-1" /> Xem thử giao diện <Separator className="flex-1" />
            </div>

            <div className="grid gap-2">
              {demoPortals.map(({ href, label, icon: Icon }) => (
                <Button key={href} variant="outline" asChild className="justify-start">
                  <Link href={href}>
                    <Icon /> {label}
                  </Link>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <WireframeNote task="2.1">đăng nhập JWT, tự chuyển tới phân hệ theo vai trò</WireframeNote>
      </div>
    </main>
  );
}
