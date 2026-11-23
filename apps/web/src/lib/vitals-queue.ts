import type { VitalEntry } from '@/lib/data/types';

/**
 * Hàng đợi chỉ số sinh tồn chưa gửi được (offline-first) — lưu trong localStorage theo từng phiếu
 * chuyển tuyến, nên vẫn còn khi tải lại trang, đóng tab hay điện thoại tắt màn hình. Bản ghi chỉ bị xoá
 * khi máy chủ xác nhận đã lưu (ack chứa clientId).
 */
export interface QueuedVital extends VitalEntry {
  /** Lỗi không thể gửi lại (dữ liệu bị máy chủ từ chối hẳn) */
  error?: string;
}

const PREFIX = 'mevita:vitals-queue:';
const EMPTY: QueuedVital[] = [];
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: QueuedVital[] }>();

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Ảnh chụp ổn định (cùng tham chiếu khi dữ liệu không đổi) cho useSyncExternalStore. */
export function readQueue(referralId: string): QueuedVital[] {
  if (typeof window === 'undefined') return EMPTY;
  const key = PREFIX + referralId;
  const raw = readRaw(key);
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value;
  let value = EMPTY;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) value = parsed as QueuedVital[];
  } catch {
    value = EMPTY;
  }
  cache.set(key, { raw, value });
  return value;
}

function write(referralId: string, items: QueuedVital[]) {
  const key = PREFIX + referralId;
  try {
    if (items.length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Bộ nhớ đầy / chế độ riêng tư: vẫn giữ trong bộ nhớ tạm để gửi khi có mạng
    cache.set(key, { raw: readRaw(key), value: items });
  }
  listeners.forEach((l) => l());
}

export function enqueue(referralId: string, entry: VitalEntry) {
  write(referralId, [...readQueue(referralId), entry]);
}

/** Bỏ các bản máy chủ đã nhận. */
export function removeAccepted(referralId: string, clientIds: string[]) {
  const done = new Set(clientIds);
  write(
    referralId,
    readQueue(referralId).filter((e) => !done.has(e.clientId)),
  );
}

/** Đánh dấu lỗi vĩnh viễn — giữ lại để người dùng thấy, không gửi lại tự động. */
export function markFailed(referralId: string, clientIds: string[], error: string) {
  const ids = new Set(clientIds);
  write(
    referralId,
    readQueue(referralId).map((e) => (ids.has(e.clientId) ? { ...e, error } : e)),
  );
}

export function discard(referralId: string, clientId: string) {
  write(
    referralId,
    readQueue(referralId).filter((e) => e.clientId !== clientId),
  );
}

export function subscribeQueue(listener: () => void) {
  listeners.add(listener);
  // Tab khác của cùng thiết bị thay đổi hàng đợi
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith(PREFIX)) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export const emptyQueue = () => EMPTY;
