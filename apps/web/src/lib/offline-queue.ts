/**
 * Hàng đợi offline-first dùng chung (sinh tồn, vị trí xe): lưu trong localStorage theo từng phiếu chuyển
 * tuyến nên còn nguyên khi tải lại trang, đóng tab hay điện thoại tắt màn hình. Bản ghi chỉ bị xoá khi
 * máy chủ xác nhận (ack chứa clientId). Ảnh chụp ổn định cho useSyncExternalStore.
 */
export type Queued<T> = T & {
  /** Lỗi không thể gửi lại (dữ liệu bị máy chủ từ chối hẳn) */
  error?: string;
};

export function createOfflineQueue<T extends { clientId: string }>(
  prefix: string,
  maxItems = 2000,
) {
  const EMPTY: Queued<T>[] = [];
  const listeners = new Set<() => void>();
  const cache = new Map<string, { raw: string | null; value: Queued<T>[] }>();

  const readRaw = (key: string) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  };

  function read(id: string): Queued<T>[] {
    if (typeof window === 'undefined') return EMPTY;
    const key = prefix + id;
    const raw = readRaw(key);
    const hit = cache.get(key);
    if (hit && hit.raw === raw) return hit.value;
    let value = EMPTY;
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) value = parsed as Queued<T>[];
    } catch {
      value = EMPTY;
    }
    cache.set(key, { raw, value });
    return value;
  }

  function write(id: string, items: Queued<T>[]) {
    const key = prefix + id;
    // Giữ bản mới nhất nếu vượt giới hạn (VD vị trí khi mất sóng rất lâu)
    const kept = items.length > maxItems ? items.slice(-maxItems) : items;
    try {
      if (kept.length === 0) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, JSON.stringify(kept));
    } catch {
      // Bộ nhớ đầy / chế độ riêng tư: vẫn giữ trong bộ nhớ tạm để gửi khi có mạng
      cache.set(key, { raw: readRaw(key), value: kept });
    }
    listeners.forEach((l) => l());
  }

  return {
    read,
    empty: () => EMPTY,
    enqueue: (id: string, entry: T) => write(id, [...read(id), entry]),
    removeAccepted: (id: string, clientIds: string[]) => {
      const done = new Set(clientIds);
      write(
        id,
        read(id).filter((e) => !done.has(e.clientId)),
      );
    },
    markFailed: (id: string, clientIds: string[], error: string) => {
      const ids = new Set(clientIds);
      write(
        id,
        read(id).map((e) => (ids.has(e.clientId) ? { ...e, error } : e)),
      );
    },
    discard: (id: string, clientId: string) =>
      write(
        id,
        read(id).filter((e) => e.clientId !== clientId),
      ),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      const onStorage = (e: StorageEvent) => {
        if (e.key?.startsWith(prefix)) listener();
      };
      window.addEventListener('storage', onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', onStorage);
      };
    },
  };
}
