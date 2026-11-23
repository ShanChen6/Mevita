'use client';

import { useTransition } from 'react';
import { Loader2, RadioTower } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { sendTestSignal } from '@/lib/actions/realtime';

/** Gửi tín hiệu kiểm tra tới mọi đồng nghiệp đang trực cùng cơ sở. */
export function TestSignalButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await sendTestSignal();
          if (!res.ok) toast.error(res.message);
          else toast.success(`Đã gửi tới ${res.data.delivered} kết nối đang trực`);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RadioTower />} Kiểm tra kênh trực
    </Button>
  );
}
