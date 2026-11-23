import { Logger } from '@nestjs/common';
import type { v2 } from 'cloudinary';
import {
  MEDIA_RULES,
  type DeliveryUrls,
  type MediaStorage,
  type StoredAsset,
  type UploadTicket,
} from './media-storage.js';

type Cloudinary = typeof v2;

/** Thuộc tính upload được ký — trình duyệt không thể đổi mà chữ ký vẫn hợp lệ. */
export function uploadParams(publicId: string, timestamp: number) {
  return {
    public_id: publicId,
    timestamp: String(timestamp),
    // Ảnh "authenticated": chỉ xem được qua URL có chữ ký do API cấp
    type: 'authenticated',
    allowed_formats: MEDIA_RULES.allowedFormats.join(','),
    overwrite: 'false',
  };
}

export class CloudinaryStorage implements MediaStorage {
  readonly mode = 'cloudinary' as const;
  private readonly logger = new Logger(CloudinaryStorage.name);

  constructor(
    private readonly cloudinary: Cloudinary,
    private readonly cloudName: string,
    private readonly apiKey: string,
    private readonly apiSecret: string,
  ) {}

  createUploadTicket(publicId: string, now = Date.now()): UploadTicket {
    const timestamp = Math.floor(now / 1000);
    const params = uploadParams(publicId, timestamp);
    const signature = this.cloudinary.utils.api_sign_request(params, this.apiSecret);
    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
      fields: { ...params, api_key: this.apiKey, signature },
      publicId,
      maxBytes: MEDIA_RULES.maxBytes,
      allowedFormats: MEDIA_RULES.allowedFormats,
      expiresAt: new Date((timestamp + MEDIA_RULES.ticketTtlSeconds) * 1000).toISOString(),
    };
  }

  async fetchAsset(publicId: string): Promise<StoredAsset | null> {
    try {
      const r = (await this.cloudinary.api.resource(publicId, {
        type: 'authenticated',
        resource_type: 'image',
      })) as {
        public_id: string;
        bytes: number;
        format: string;
        width?: number;
        height?: number;
        secure_url: string;
      };
      return {
        publicId: r.public_id,
        bytes: r.bytes,
        format: r.format,
        width: r.width ?? null,
        height: r.height ?? null,
        canonicalUrl: r.secure_url,
      };
    } catch (error) {
      this.logger.warn(
        `Không tìm thấy ảnh ${publicId}: ${(error as { error?: { message?: string } }).error?.message ?? String(error)}`,
      );
      return null;
    }
  }

  deliveryUrls(publicId: string): DeliveryUrls {
    const base = { type: 'authenticated', sign_url: true, secure: true } as const;
    return {
      url: this.cloudinary.url(publicId, {
        ...base,
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      }),
      thumbnailUrl: this.cloudinary.url(publicId, {
        ...base,
        transformation: [
          { width: 240, height: 240, crop: 'fill', quality: 'auto', fetch_format: 'auto' },
        ],
      }),
    };
  }

  async delete(publicId: string): Promise<void> {
    await this.cloudinary.uploader.destroy(publicId, { type: 'authenticated', invalidate: true });
  }
}
