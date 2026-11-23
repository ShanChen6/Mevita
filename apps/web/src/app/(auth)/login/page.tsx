import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { AuthCard } from '@/components/auth/auth-card';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = { title: 'Đăng nhập' };

const demoAccounts = [
  { role: 'Bệnh nhân', email: 'cuong@mevita.vn' },
  { role: 'Bác sĩ Tuyến Xã', email: 'bs.an@mevita.vn' },
  { role: 'Điều dưỡng (đi xe cứu thương)', email: 'dd.hoa@mevita.vn' },
  { role: 'Bác sĩ Tuyến Tỉnh', email: 'bs.binh@mevita.vn' },
  { role: 'Bác sĩ Tuyến Tỉnh (đồng nghiệp)', email: 'bs.minh@mevita.vn' },
  { role: 'Quản trị', email: 'admin@mevita.vn' },
];

export default function LoginPage() {
  return (
    <AuthCard
      title="Đăng nhập"
      description="Dùng email hoặc số điện thoại đã đăng ký."
      footer={
        process.env.NODE_ENV !== 'production' && (
          <details className="bg-card rounded-lg border p-3 text-sm">
            <summary className="cursor-pointer font-medium">
              Tài khoản demo (môi trường phát triển)
            </summary>
            <p className="text-muted-foreground mt-2">
              Mật khẩu: <code className="font-mono">SEED_DEMO_PASSWORD</code> trong{' '}
              <code>apps/api/.env</code>
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {demoAccounts.map((a) => (
                <li key={a.email} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">{a.role}</span>
                  <code className="font-mono">{a.email}</code>
                </li>
              ))}
            </ul>
          </details>
        )
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="text-muted-foreground mt-6 text-center text-sm">
        Bệnh nhân chưa có tài khoản?{' '}
        <Link href="/register" className="text-primary font-medium hover:underline">
          Đăng ký
        </Link>
      </p>
    </AuthCard>
  );
}
