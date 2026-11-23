import { createOfflineQueue } from './offline-queue';

/** Điểm vị trí xe chờ gửi (offline-first). */
export interface LocationEntry {
  clientId: string;
  recordedAt: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
}

export const locationQueue = createOfflineQueue<LocationEntry>('mevita:location-queue:', 3000);
