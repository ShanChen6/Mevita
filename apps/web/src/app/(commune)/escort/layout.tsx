import type { Metadata } from 'next';
import { Toaster } from 'sonner';

import { RealtimeProvider } from '@/components/realtime/realtime-provider';

export const metadata: Metadata = { title: 'Cập nhật trên xe · Mevita' };

/** Màn hình trên xe: chỉ cần kênh realtime, không có sidebar để tối giản trên điện thoại. */
export default function EscortLayout({ children }: LayoutProps<'/escort'>) {
  return (
    <RealtimeProvider>
      {children}
      <Toaster position="top-center" richColors />
    </RealtimeProvider>
  );
}
