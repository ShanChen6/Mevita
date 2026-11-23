import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { uploadParams } from './cloudinary-storage.js';
import {
  MEDIA_RULES,
  type DeliveryUrls,
  type MediaStorage,
  type StoredAsset,
  type UploadTicket,
} from './media-storage.js';

export const MOCK_API_KEY = 'mock-api-key';

/** Nhận diện định dạng ảnh theo nội dung (magic bytes), không tin tên file hay MIME do trình duyệt gửi. */
export function sniffImageFormat(buf: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'png';
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'webp';
  return null;
}

/** Kích thước ảnh PNG (đọc từ khối IHDR); định dạng khác trả null. */
function pngSize(buf: Buffer) {
  return buf.length >= 24 ? { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) } : null;
}

export class MockUploadError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface MockMeta {
  publicId: string;
  bytes: number;
  format: string;
  width: number | null;
  height: number | null;
  mime: string;
}

const MIME: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/**
 * Giả lập Cloudinary cho môi trường phát triển/kiểm thử: kiểm tra chữ ký upload theo đúng thuật toán
 * của Cloudinary, lưu file vào thư mục cục bộ và phục vụ ảnh qua URL có chữ ký HMAC.
 * Không dùng trong production.
 */
export class MockStorage implements MediaStorage {
  readonly mode = 'mock' as const;
  private readonly dir: string;

  constructor(
    dir: string,
    private readonly publicApiUrl: string,
    private readonly secret: string,
  ) {
    this.dir = resolve(dir);
  }

  createUploadTicket(publicId: string, now = Date.now()): UploadTicket {
    const timestamp = Math.floor(now / 1000);
    const params = uploadParams(publicId, timestamp);
    return {
      uploadUrl: `${this.publicApiUrl}/mock-cloudinary/image/upload`,
      fields: {
        ...params,
        api_key: MOCK_API_KEY,
        signature: cloudinary.utils.api_sign_request(params, this.secret),
      },
      publicId,
      maxBytes: MEDIA_RULES.maxBytes,
      allowedFormats: MEDIA_RULES.allowedFormats,
      expiresAt: new Date((timestamp + MEDIA_RULES.ticketTtlSeconds) * 1000).toISOString(),
    };
  }

  /** Xử lý upload như Cloudinary: kiểm tra chữ ký, hạn, định dạng, dung lượng, không ghi đè. */
  async receive(
    fields: Record<string, string | undefined>,
    file: Buffer | undefined,
    now = Date.now(),
  ) {
    const { api_key, signature, ...rest } = fields;
    if (api_key !== MOCK_API_KEY) throw new MockUploadError(401, 'Invalid api_key');
    if (!file) throw new MockUploadError(400, 'Missing required parameter - file');

    const signed = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v !== undefined),
    ) as Record<string, string>;
    const expected = cloudinary.utils.api_sign_request(signed, this.secret);
    if (
      !signature ||
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      throw new MockUploadError(401, 'Invalid Signature');
    }
    const ts = Number(signed.timestamp);
    if (!Number.isFinite(ts) || now / 1000 - ts > MEDIA_RULES.ticketTtlSeconds) {
      throw new MockUploadError(400, 'Stale request - reported time is too old');
    }
    const publicId = signed.public_id;
    if (!publicId) throw new MockUploadError(400, 'Missing public_id');
    if (file.length > MEDIA_RULES.maxBytes)
      throw new MockUploadError(400, `File size too large. Maximum is ${MEDIA_RULES.maxBytes}`);

    const format = sniffImageFormat(file);
    const allowed = (signed.allowed_formats ?? '').split(',');
    if (!format || !allowed.includes(format))
      throw new MockUploadError(400, `Image file format ${format ?? 'unknown'} not allowed`);
    if (signed.overwrite === 'false' && (await this.readMeta(publicId))) {
      throw new MockUploadError(409, 'Resource already exists');
    }

    const meta: MockMeta = {
      publicId,
      bytes: file.length,
      format,
      mime: MIME[format],
      ...(format === 'png' ? pngSize(file)! : { width: null, height: null }),
    };
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.path(publicId, 'bin'), file);
    await writeFile(this.path(publicId, 'json'), JSON.stringify(meta));
    return {
      public_id: publicId,
      type: 'authenticated',
      resource_type: 'image',
      format,
      bytes: file.length,
      width: meta.width,
      height: meta.height,
      secure_url: this.canonical(publicId),
    };
  }

  async fetchAsset(publicId: string): Promise<StoredAsset | null> {
    const meta = await this.readMeta(publicId);
    return meta
      ? {
          publicId,
          bytes: meta.bytes,
          format: meta.format,
          width: meta.width,
          height: meta.height,
          canonicalUrl: this.canonical(publicId),
        }
      : null;
  }

  deliveryUrls(publicId: string): DeliveryUrls {
    const url = (variant: 'full' | 'thumb') =>
      `${this.publicApiUrl}/mock-cloudinary/file?${new URLSearchParams({ id: publicId, v: variant, sig: this.sign(publicId, variant) })}`;
    return { url: url('full'), thumbnailUrl: url('thumb') };
  }

  async delete(publicId: string): Promise<void> {
    await rm(this.path(publicId, 'bin'), { force: true });
    await rm(this.path(publicId, 'json'), { force: true });
  }

  /** Đọc file để phục vụ; null nếu chữ ký URL sai hoặc không có file. */
  async read(publicId: string, variant: string, sig: string) {
    const expected = this.sign(publicId, variant);
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
      return null;
    const meta = await this.readMeta(publicId);
    if (!meta) return null;
    return { data: await readFile(this.path(publicId, 'bin')), mime: meta.mime };
  }

  private sign(publicId: string, variant: string) {
    return createHmac('sha256', this.secret)
      .update(`${variant}:${publicId}`)
      .digest('base64url')
      .slice(0, 32);
  }

  private canonical(publicId: string) {
    return `mock://authenticated/${publicId}`;
  }

  /** Tên file = băm của publicId → không thể thoát khỏi thư mục lưu (path traversal). */
  private path(publicId: string, ext: 'bin' | 'json') {
    return join(this.dir, `${createHash('sha256').update(publicId).digest('hex')}.${ext}`);
  }

  private async readMeta(publicId: string): Promise<MockMeta | null> {
    try {
      return JSON.parse(await readFile(this.path(publicId, 'json'), 'utf8')) as MockMeta;
    } catch {
      return null;
    }
  }
}
