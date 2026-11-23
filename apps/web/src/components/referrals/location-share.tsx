'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Loader2, LocateFixed, LocateOff, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

import { useRealtime } from '@/components/realtime/realtime-provider';
import { Button } from '@/components/ui/button';
import { markPickedUp } from '@/lib/actions/referrals';
import { formatTime } from '@/lib/format';
import { haversineKm } from '@/lib/geo';
import { locationQueue, type LocationEntry } from '@/lib/location-queue';
import { cn } from '@/lib/utils';

type Ack =
  | { ok: true; accepted: string[]; created: number }
  | { ok: false; message: string; retry: boolean };

/** Gửi tối đa mỗi 10 giây, hoặc sớm hơn khi xe đã đi được ≥ 50 m */
const MIN_INTERVAL_MS = 10_000;
const MIN_MOVE_KM = 0.05;
const PREF = 'mevita:share-location:';

const subscribeOnline = (cb: () => void) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};

function readPref(id: string) {
  try {
    return window.localStorage.getItem(PREF + id) === 'on';
  } catch {
    return false;
  }
}

/**
 * Chia sẻ vị trí xe từ điện thoại người đi kèm (Task C): GPS → hàng đợi localStorage → Socket.io có ack.
 * Mất sóng thì lưu tạm và gửi bù; giữ màn hình sáng khi đang chia sẻ (trình duyệt dừng GPS khi tắt màn hình).
 */
export function LocationShare({
  referralId,
  showPickedUp,
}: {
  referralId: string;
  /** Xe đón chưa ghi nhận đã đón bệnh nhân */
  showPickedUp: boolean;
}) {
  const { socket, status } = useRealtime();
  const queue = useSyncExternalStore(
    locationQueue.subscribe,
    () => locationQueue.read(referralId),
    locationQueue.empty,
  );
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFix, setLastFix] = useState<{ at: string; accuracy: number | null } | null>(null);
  const [pickingUp, setPickingUp] = useState(false);
  const lastSent = useRef<{ at: number; lat: number; lng: number } | null>(null);
  const flushing = useRef(false);
  const pending = queue.filter((e) => !e.error);

  const flush = useCallback(() => {
    const batch = locationQueue
      .read(referralId)
      .filter((e) => !e.error)
      .slice(0, 200);
    if (!socket?.connected || !navigator.onLine || flushing.current || batch.length === 0) return;
    flushing.current = true;
    socket
      .timeout(8000)
      .emit('vehicle_location', { referralId, entries: batch }, (err: Error | null, ack?: Ack) => {
        flushing.current = false;
        if (err || !ack) return;
        if (ack.ok) locationQueue.removeAccepted(referralId, ack.accepted);
        else if (!ack.retry) {
          locationQueue.markFailed(
            referralId,
            batch.map((e) => e.clientId),
            ack.message,
          );
          setError(ack.message);
        }
      });
  }, [socket, referralId]);

  const onPosition = useCallback(
    (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy, speed, heading } = pos.coords;
      setLastFix({
        at: new Date(pos.timestamp).toISOString(),
        accuracy: accuracy ? Math.round(accuracy) : null,
      });
      setError(null);
      const prev = lastSent.current;
      const moved = prev
        ? haversineKm({ latitude: prev.lat, longitude: prev.lng }, { latitude, longitude })
        : Infinity;
      if (prev && pos.timestamp - prev.at < MIN_INTERVAL_MS && moved < MIN_MOVE_KM) return;
      lastSent.current = { at: pos.timestamp, lat: latitude, lng: longitude };
      const entry: LocationEntry = {
        clientId: crypto.randomUUID(),
        recordedAt: new Date(pos.timestamp).toISOString(),
        latitude,
        longitude,
        accuracy: accuracy ?? null,
        speed: speed != null && speed >= 0 ? speed : null,
        heading: heading != null && !Number.isNaN(heading) ? heading : null,
      };
      locationQueue.enqueue(referralId, entry);
      flush();
    },
    [referralId, flush],
  );

  // Bật lại nếu trước đó đang chia sẻ (tải lại trang giữa đường)
  useEffect(() => {
    const t = setTimeout(() => {
      if (readPref(referralId)) setSharing(true);
    }, 0);
    return () => clearTimeout(t);
  }, [referralId]);

  useEffect(() => {
    if (!sharing) return;
    if (!('geolocation' in navigator)) {
      const t = setTimeout(() => setError('Thiết bị không hỗ trợ định vị'), 0);
      return () => clearTimeout(t);
    }
    const watch = navigator.geolocation.watchPosition(
      onPosition,
      (e) =>
        setError(
          e.code === e.PERMISSION_DENIED
            ? 'Chưa cho phép truy cập vị trí — bật quyền Vị trí cho trình duyệt rồi thử lại'
            : 'Chưa bắt được GPS — đang thử lại',
        ),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20_000 },
    );
    let lock: { release(): Promise<void> } | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> };
    };
    nav.wakeLock
      ?.request('screen')
      .then((l) => (lock = l))
      .catch(() => {});
    return () => {
      navigator.geolocation.clearWatch(watch);
      void lock?.release().catch(() => {});
    };
  }, [sharing, onPosition]);

  useEffect(() => {
    if (!socket) return;
    socket.on('connect', flush);
    window.addEventListener('online', flush);
    const timer = setInterval(flush, 10_000);
    const first = setTimeout(flush, 0);
    return () => {
      socket.off('connect', flush);
      window.removeEventListener('online', flush);
      clearInterval(timer);
      clearTimeout(first);
    };
  }, [socket, flush]);

  const toggle = () => {
    const next = !sharing;
    try {
      window.localStorage.setItem(PREF + referralId, next ? 'on' : 'off');
    } catch {
      // bỏ qua
    }
    if (next) lastSent.current = null;
    setSharing(next);
  };

  const connected = status === 'connected' && online;
  return (
    <section
      className="flex flex-col gap-2 rounded-lg border p-3"
      aria-label="Chia sẻ vị trí xe"
      data-testid="location-share"
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex size-8 items-center justify-center rounded-full',
            sharing
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
              : 'bg-muted text-muted-foreground',
          )}
          aria-hidden
        >
          {sharing ? <LocateFixed className="size-4" /> : <LocateOff className="size-4" />}
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">
            {sharing ? 'Đang chia sẻ vị trí xe' : 'Chưa chia sẻ vị trí xe'}
          </p>
          <p className="text-muted-foreground text-xs" data-testid="location-status">
            {sharing
              ? lastFix
                ? `GPS ${formatTime(lastFix.at)}${lastFix.accuracy != null ? ` · ±${lastFix.accuracy} m` : ''}${
                    pending.length
                      ? ` · ${pending.length} điểm ${connected ? 'đang gửi' : 'lưu tạm (mất sóng)'}`
                      : ' · đã gửi'
                  }`
                : 'Đang bắt GPS…'
              : 'Bệnh viện nhận sẽ thấy xe trên bản đồ và giờ tới chính xác hơn'}
          </p>
        </div>
        <Button type="button" variant={sharing ? 'outline' : 'default'} onClick={toggle}>
          {sharing ? 'Tắt' : 'Bật chia sẻ'}
        </Button>
      </div>
      {error && (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      )}
      {showPickedUp && (
        <Button
          type="button"
          size="lg"
          className="h-12"
          disabled={pickingUp}
          onClick={async () => {
            setPickingUp(true);
            const res = await markPickedUp(referralId);
            setPickingUp(false);
            if (!res.ok) toast.error(res.message);
            else toast.success('Đã ghi nhận đón bệnh nhân — bắt đầu chặng chở về bệnh viện');
          }}
        >
          {pickingUp ? <Loader2 className="animate-spin" /> : <UserCheck />} Đã đón bệnh nhân lên xe
        </Button>
      )}
    </section>
  );
}
