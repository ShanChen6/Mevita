import type { VitalEntry } from '@/lib/data/types';
import { createOfflineQueue, type Queued } from './offline-queue';

/** Hàng đợi chỉ số sinh tồn chưa gửi được (offline-first) — xem lib/offline-queue.ts. */
export type QueuedVital = Queued<VitalEntry>;

const q = createOfflineQueue<VitalEntry>('mevita:vitals-queue:');

export const readQueue = q.read;
export const emptyQueue = q.empty;
export const enqueue = q.enqueue;
export const removeAccepted = q.removeAccepted;
export const markFailed = q.markFailed;
export const discard = q.discard;
export const subscribeQueue = q.subscribe;
