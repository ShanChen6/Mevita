/**
 * Kho ảnh cận lâm sàng. Hai cách triển khai cùng giao diện:
 * - CloudinaryStorage: Cloudinary thật (signed upload, ảnh "authenticated", URL có chữ ký).
 * - MockStorage: giả lập Cloudinary cho môi trường phát triển/kiểm thử khi chưa có khoá.
 */
export const MEDIA_STORAGE = Symbol('MEDIA_STORAGE');

export const MEDIA_RULES = {
  /** Định dạng ảnh cho phép tải lên */
  allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
  /** Dung lượng tối đa mỗi ảnh (10 MB — giới hạn ảnh của gói Cloudinary miễn phí) */
  maxBytes: 10 * 1024 * 1024,
  /** Số ảnh tối đa mỗi hồ sơ */
  maxPerRecord: 20,
  /** Hiệu lực của chữ ký upload (Cloudinary chấp nhận tối đa 1 giờ) */
  ticketTtlSeconds: 60 * 60,
} as const;

/** Thông tin để trình duyệt tải ảnh thẳng lên kho (multipart/form-data, trường file = "file"). */
export interface UploadTicket {
  uploadUrl: string;
  fields: Record<string, string>;
  publicId: string;
  maxBytes: number;
  allowedFormats: readonly string[];
  expiresAt: string;
}

export interface StoredAsset {
  publicId: string;
  bytes: number;
  format: string;
  width: number | null;
  height: number | null;
  /** URL gốc (không ký) — lưu tham chiếu trong DB */
  canonicalUrl: string;
}

export interface DeliveryUrls {
  /** Ảnh gốc, URL có chữ ký */
  url: string;
  /** Ảnh thu nhỏ 240×240, URL có chữ ký */
  thumbnailUrl: string;
}

export interface MediaStorage {
  readonly mode: 'cloudinary' | 'mock' | 'disabled';
  createUploadTicket(publicId: string): UploadTicket;
  /** Đọc thông tin ảnh đã tải lên trực tiếp từ kho (không tin dữ liệu trình duyệt gửi). */
  fetchAsset(publicId: string): Promise<StoredAsset | null>;
  deliveryUrls(publicId: string): DeliveryUrls;
  delete(publicId: string): Promise<void>;
}
