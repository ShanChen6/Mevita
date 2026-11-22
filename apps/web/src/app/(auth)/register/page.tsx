import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthCard } from '@/components/auth/auth-card';
import { RegisterForm } from '@/components/auth/register-form';

export const metadata: Metadata = { title: 'Đăng ký' };

export default function RegisterPage() {
  return (
    <AuthCard
      wide
      title="Đăng ký tài khoản bệnh nhân"
      description="Đặt lịch khám và xem lại toàn bộ lịch sử khám bệnh của bạn."
    >
      <RegisterForm />
      <p className="text-muted-foreground mt-6 text-center text-sm">
        Đã có tài khoản?{' '}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Đăng nhập
        </Link>
        <br />
        <span className="text-xs">Tài khoản bác sĩ, nhân viên y tế do quản trị viên cấp.</span>
      </p>
    </AuthCard>
  );
}
