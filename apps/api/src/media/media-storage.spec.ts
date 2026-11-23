import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from './cloudinary-storage.js';
import { MEDIA_RULES } from './media-storage.js';
import { MOCK_API_KEY, MockStorage, MockUploadError, sniffImageFormat } from './mock-storage.js';

/** PNG 2×3 pixel hợp lệ tối thiểu (chỉ cần đầu file cho kiểm tra) */
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]),
  Buffer.from('IHDR'),
  Buffer.from([0, 0, 0, 2, 0, 0, 0, 3]),
  Buffer.alloc(20),
]);
const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100)]);

describe('sniffImageFormat', () => {
  it('nhận diện theo nội dung, không theo tên file', () => {
    expect(sniffImageFormat(png)).toBe('png');
    expect(sniffImageFormat(jpg)).toBe('jpg');
    expect(sniffImageFormat(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe('webp');
    expect(sniffImageFormat(Buffer.from('%PDF-1.7 giả làm ảnh'))).toBeNull();
  });
});

describe('MockStorage (giả lập Cloudinary)', () => {
  let dir: string;
  let storage: MockStorage;
  const publicId = 'mevita/records/abc/0001';

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mevita-media-'));
    storage = new MockStorage(dir, 'http://api.test/api', 'mock-secret');
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('vé upload có chữ ký đúng thuật toán của Cloudinary', () => {
    const t = storage.createUploadTicket(publicId);
    const { api_key, signature, ...signed } = t.fields;
    expect(api_key).toBe(MOCK_API_KEY);
    expect(signature).toBe(cloudinary.utils.api_sign_request(signed, 'mock-secret'));
    expect(t.fields).toMatchObject({
      public_id: publicId,
      type: 'authenticated',
      allowed_formats: 'jpg,jpeg,png,webp',
    });
  });

  it('nhận ảnh hợp lệ, đọc lại thông tin và phục vụ qua URL có chữ ký', async () => {
    const t = storage.createUploadTicket(publicId);
    const res = await storage.receive(t.fields, png);
    expect(res).toMatchObject({
      public_id: publicId,
      format: 'png',
      bytes: png.length,
      width: 2,
      height: 3,
    });
    expect(await storage.fetchAsset(publicId)).toMatchObject({ format: 'png', bytes: png.length });

    const { url, thumbnailUrl } = storage.deliveryUrls(publicId);
    const q = new URL(url).searchParams;
    expect(await storage.read(q.get('id')!, q.get('v')!, q.get('sig')!)).toMatchObject({
      mime: 'image/png',
    });
    // Chữ ký của ảnh thu nhỏ không dùng được cho ảnh gốc, chữ ký sai bị từ chối
    expect(
      await storage.read(publicId, 'full', new URL(thumbnailUrl).searchParams.get('sig')!),
    ).toBeNull();
    expect(await storage.read(publicId, 'full', 'x'.repeat(32))).toBeNull();
  });

  const expectError = async (p: Promise<unknown>, status: number, msg: RegExp) => {
    const err = await p.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MockUploadError);
    expect((err as MockUploadError).status).toBe(status);
    expect((err as MockUploadError).message).toMatch(msg);
  };

  it('từ chối khi trình duyệt sửa tham số đã ký (VD đổi sang thư mục hồ sơ khác)', async () => {
    const t = storage.createUploadTicket(publicId);
    await expectError(
      storage.receive({ ...t.fields, public_id: 'mevita/records/other/0001' }, png),
      401,
      /Signature/,
    );
    await expectError(
      storage.receive({ ...t.fields, allowed_formats: 'jpg,pdf' }, png),
      401,
      /Signature/,
    );
    await expectError(storage.receive({ ...t.fields, api_key: 'khac' }, png), 401, /api_key/);
  });

  it('từ chối vé quá hạn, file không phải ảnh, file quá lớn và ghi đè', async () => {
    const old = storage.createUploadTicket(
      publicId,
      Date.now() - (MEDIA_RULES.ticketTtlSeconds + 60) * 1000,
    );
    await expectError(storage.receive(old.fields, png), 400, /Stale/);

    const t = storage.createUploadTicket(publicId);
    await expectError(storage.receive(t.fields, Buffer.from('%PDF-1.7')), 400, /not allowed/);
    await expectError(
      storage.receive(t.fields, Buffer.concat([jpg, Buffer.alloc(MEDIA_RULES.maxBytes)])),
      400,
      /too large/,
    );
    await expectError(storage.receive(t.fields, undefined), 400, /file/);

    await storage.receive(t.fields, jpg);
    await expectError(
      storage.receive(storage.createUploadTicket(publicId).fields, jpg),
      409,
      /exists/,
    );
  });

  it('xoá ảnh', async () => {
    await storage.receive(storage.createUploadTicket(publicId).fields, png);
    await storage.delete(publicId);
    expect(await storage.fetchAsset(publicId)).toBeNull();
  });
});

describe('CloudinaryStorage', () => {
  cloudinary.config({ cloud_name: 'demo', api_key: '123', api_secret: 'secret' });
  const storage = new CloudinaryStorage(cloudinary, 'demo', '123', 'secret');

  it('vé upload gửi thẳng tới Cloudinary, chữ ký khớp với khoá bí mật', () => {
    const t = storage.createUploadTicket('mevita/records/x/1', 1_700_000_000_000);
    expect(t.uploadUrl).toBe('https://api.cloudinary.com/v1_1/demo/image/upload');
    const { api_key, signature, ...signed } = t.fields;
    expect(api_key).toBe('123');
    expect(signature).toBe(cloudinary.utils.api_sign_request(signed, 'secret'));
    expect(t.fields).not.toHaveProperty('api_secret');
  });

  it('URL xem ảnh là ảnh "authenticated" có chữ ký, ảnh thu nhỏ 240×240', () => {
    const { url, thumbnailUrl } = storage.deliveryUrls('mevita/records/x/1');
    expect(url).toMatch(/\/image\/authenticated\/s--[\w-]{8}--\//);
    expect(thumbnailUrl).toContain('c_fill,f_auto,h_240,q_auto,w_240');
  });
});
