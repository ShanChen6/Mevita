'use client';

import { useSyncExternalStore } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { isSoundEnabled, setSoundEnabled, subscribeSound } from '@/lib/alert-sound';

/** Bật/tắt âm thanh cảnh báo ca chuyển tuyến mới (mặc định bật). */
export function SoundToggle() {
  const on = useSyncExternalStore(subscribeSound, isSoundEnabled, () => true);
  return (
    <Button variant="outline" onClick={() => setSoundEnabled(!on)} aria-pressed={on}>
      {on ? <Volume2 /> : <VolumeX />} {on ? 'Âm thanh: bật' : 'Âm thanh: tắt'}
    </Button>
  );
}
