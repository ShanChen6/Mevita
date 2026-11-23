'use client';

import { createContext, use, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { env } from '@/lib/env';

export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting' | 'unauthorized';

export interface OnDutyStaff {
  userId: string;
  fullName: string;
  academicTitle: string | null;
  connections: number;
}

interface RealtimeValue {
  socket: Socket | null;
  status: RealtimeStatus;
  onDuty: OnDutyStaff[];
}

const RealtimeContext = createContext<RealtimeValue | null>(null);

/** Lấy vé socket mới cho mỗi lần (kết nối lại) — vé chỉ có hiệu lực 60 giây. */
function fetchTicket(cb: (data: { token: string }) => void) {
  fetch('/api/realtime/ticket', { method: 'POST' })
    .then((r) =>
      r.ok
        ? (r.json() as Promise<{ ticket: string }>)
        : Promise.reject(new Error(String(r.status))),
    )
    .then((d) => cb({ token: d.ticket }))
    .catch(() => cb({ token: '' }));
}

/**
 * Kết nối Socket.io (namespace /realtime) dùng chung cho cả phân hệ.
 * Tự kết nối lại khi mất mạng; vé hết hạn/bị từ chối thì thử lại sau 5 giây.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  // Tạo socket một lần ở trình duyệt (không tự kết nối khi render phía server)
  const [socket] = useState<Socket | null>(() =>
    typeof window === 'undefined'
      ? null
      : io(`${env.NEXT_PUBLIC_SOCKET_URL}/realtime`, {
          auth: fetchTicket,
          transports: ['websocket'],
          autoConnect: false,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 10_000,
        }),
  );
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const [onDuty, setOnDuty] = useState<OnDutyStaff[]>([]);

  useEffect(() => {
    if (!socket) return;
    let retry: ReturnType<typeof setTimeout> | undefined;
    socket.on('connect', () => setStatus('connected'));
    socket.on('disconnect', () => setStatus('reconnecting'));
    socket.on('connect_error', (err) => {
      if (err.message === 'unauthorized') {
        // Lỗi xác thực ở middleware: socket.io không tự thử lại — tự lên lịch thử lại
        setStatus('unauthorized');
        retry = setTimeout(() => socket.connect(), 5000);
      } else {
        setStatus('reconnecting');
      }
    });
    socket.on('presence_update', (p: { onDuty: OnDutyStaff[] }) => setOnDuty(p.onDuty));
    socket.connect();
    return () => {
      clearTimeout(retry);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [socket]);

  return <RealtimeContext value={{ socket, status, onDuty }}>{children}</RealtimeContext>;
}

export function useRealtime(): RealtimeValue {
  const value = use(RealtimeContext);
  if (!value) throw new Error('useRealtime cần nằm trong RealtimeProvider');
  return value;
}

/** Đăng ký nhận một sự kiện realtime; handler luôn là bản mới nhất mà không phải đăng ký lại. */
export function useRealtimeEvent<T>(event: string, handler: (payload: T) => void) {
  const { socket } = useRealtime();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (!socket) return;
    const listener = (payload: T) => ref.current(payload);
    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
  }, [socket, event]);
}
