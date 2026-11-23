import { ServiceUnavailableException } from '@nestjs/common';
import type { DeliveryUrls, MediaStorage, StoredAsset, UploadTicket } from './media-storage.js';

/** Production chưa cấu hình Cloudinary: tắt tải ảnh (không giả lập trên môi trường thật). */
export class DisabledStorage implements MediaStorage {
  readonly mode = 'disabled' as const;

  createUploadTicket(): UploadTicket {
    throw new ServiceUnavailableException('Chưa cấu hình kho ảnh Cloudinary');
  }

  fetchAsset(): Promise<StoredAsset | null> {
    return Promise.resolve(null);
  }

  deliveryUrls(): DeliveryUrls {
    return { url: '', thumbnailUrl: '' };
  }

  delete(): Promise<void> {
    return Promise.resolve();
  }
}
