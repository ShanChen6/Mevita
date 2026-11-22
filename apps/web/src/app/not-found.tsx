import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <FileQuestion className="text-muted-foreground size-10" aria-hidden />
      <h1 className="text-2xl font-bold">Không tìm thấy trang</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        Trang không tồn tại, hoặc bạn không có quyền xem hồ sơ này. Nếu bạn là bác sĩ, hãy tra cứu
        bệnh nhân bằng mã định danh khi bệnh nhân có mặt tại cơ sở.
      </p>
      <Button asChild>
        <Link href="/">Về trang chủ</Link>
      </Button>
    </main>
  );
}
