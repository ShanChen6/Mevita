import Link from 'next/link';
import { Ambulance, CalendarCheck, FileHeart } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const features = [
  {
    icon: CalendarCheck,
    title: 'Đặt lịch khám',
    description: 'Bệnh nhân đặt trước lịch khám tại Trạm y tế xã hoặc Bệnh viện tỉnh.',
  },
  {
    icon: FileHeart,
    title: 'Hồ sơ bệnh án điện tử',
    description: 'Lưu vết bác sĩ khám, chẩn đoán ICD-10, đơn thuốc và ảnh cận lâm sàng.',
  },
  {
    icon: Ambulance,
    title: 'Chuyển tuyến thời gian thực',
    description: 'Truyền chỉ số sinh tồn từ xe cứu thương lên bệnh viện tuyến trên tức thì.',
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-4 py-16 sm:px-6">
      <section className="flex flex-col items-start gap-4">
        <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-medium">
          Đang phát triển
        </span>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Mevita</h1>
        <p className="text-muted-foreground max-w-2xl text-lg">
          Hệ thống Quản lý Hồ sơ Y tế Điện tử, Đặt lịch khám &amp; Chuyển tuyến Thời gian thực từ
          Trạm y tế xã lên Bệnh viện tỉnh/liên tỉnh.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" asChild>
            <Link href="/login">Đăng nhập</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/province">Xem trung tâm điều phối</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {features.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardHeader>
              <Icon className="text-primary size-6" aria-hidden />
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </section>
    </main>
  );
}
