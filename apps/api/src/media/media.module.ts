import { createHmac } from 'node:crypto';
import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { v2 } from 'cloudinary';
import { CLOUDINARY } from '../cloudinary/cloudinary.constants.js';
import type { Env } from '../config/env.validation.js';
import { CloudinaryStorage } from './cloudinary-storage.js';
import { DisabledStorage } from './disabled-storage.js';
import { MEDIA_STORAGE, type MediaStorage } from './media-storage.js';
import { MockCloudinaryController } from './mock-cloudinary.controller.js';
import { MockStorage } from './mock-storage.js';

/**
 * Chọn kho ảnh: có khoá Cloudinary → Cloudinary thật; chưa có và không phải production → giả lập;
 * production chưa cấu hình → tắt tải ảnh.
 */
@Global()
@Module({
  controllers: [MockCloudinaryController],
  providers: [
    {
      provide: MEDIA_STORAGE,
      inject: [ConfigService, CLOUDINARY],
      useFactory: (config: ConfigService<Env, true>, client: typeof v2 | null): MediaStorage => {
        const logger = new Logger('MediaModule');
        if (client) {
          return new CloudinaryStorage(
            client,
            config.get('CLOUDINARY_CLOUD_NAME', { infer: true }),
            config.get('CLOUDINARY_API_KEY', { infer: true }),
            config.get('CLOUDINARY_API_SECRET', { infer: true }),
          );
        }
        if (config.get('NODE_ENV', { infer: true }) === 'production') {
          logger.warn('Production chưa cấu hình Cloudinary — tắt tải ảnh cận lâm sàng.');
          return new DisabledStorage();
        }
        logger.warn(
          'Chưa cấu hình Cloudinary — dùng kho ảnh GIẢ LẬP (chỉ cho phát triển/kiểm thử).',
        );
        // Khoá ký riêng cho giả lập, suy ra từ khoá JWT
        const secret = createHmac('sha256', config.get('JWT_ACCESS_SECRET', { infer: true }))
          .update('mock-cloudinary')
          .digest('hex');
        return new MockStorage(
          config.get('MEDIA_MOCK_DIR', { infer: true }),
          config.get('API_PUBLIC_URL', { infer: true }),
          secret,
        );
      },
    },
  ],
  exports: [MEDIA_STORAGE],
})
export class MediaModule {}
