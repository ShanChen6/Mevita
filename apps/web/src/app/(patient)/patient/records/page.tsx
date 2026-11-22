import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { FileHeart } from 'lucide-react';

import { RecordTimeline } from '@/components/patient/record-timeline';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getMyRecords } from '@/lib/data/patient';

export const metadata: Metadata = { title: 'Lịch sử khám bệnh' };

async function History() {
  const page = await getMyRecords();
  if (page.items.length === 0) {
    return (
      <Card className="items-center gap-3 px-6 py-12 text-center">
        <FileHeart className="text-muted-foreground size-8" aria-hidden />
        <p className="font-medium">Chưa có lần khám nào được lưu</p>
        <p className="text-muted-foreground max-w-md text-sm">
          Sau mỗi lần khám tại cơ sở y tế dùng Mevita, bác sĩ ký xác nhận và hồ sơ sẽ xuất hiện tại
          đây.
        </p>
        <Button asChild>
          <Link href="/patient/appointments/new">Đặt lịch khám</Link>
        </Button>
      </Card>
    );
  }
  return <RecordTimeline initial={page} />;
}

function HistorySkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Đang tải lịch sử khám">
      {[0, 1].map((i) => (
        <div key={i} className="bg-muted/50 h-56 animate-pulse rounded-xl border" />
      ))}
    </div>
  );
}

export default function MedicalHistoryPage() {
  return (
    <>
      <PageHeader
        title="Lịch sử khám bệnh"
        description="Mọi lần khám tại các cơ sở y tế, kèm bác sĩ, chẩn đoán, đơn thuốc và kết quả cận lâm sàng."
      />
      <Suspense fallback={<HistorySkeleton />}>
        <History />
      </Suspense>
    </>
  );
}
