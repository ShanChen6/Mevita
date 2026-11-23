import type { Metadata } from 'next';

import { RealtimeNotifications } from '@/components/realtime/realtime-notifications';
import { RealtimeProvider } from '@/components/realtime/realtime-provider';

export const metadata: Metadata = { title: 'Cập nhật trên xe · Mevita' };

/** Màn hình trên xe: chỉ cần kênh realtime (phản hồi của tuyến trên), không sidebar cho gọn trên điện thoại. */
export default function EscortLayout({ children }: LayoutProps<'/escort'>) {
  return (
    <RealtimeProvider>
      {children}
      <RealtimeNotifications offset={16} />
    </RealtimeProvider>
  );
}
