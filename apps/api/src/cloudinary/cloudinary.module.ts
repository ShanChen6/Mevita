import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import type { Env } from '../config/env.validation.js';
import { CLOUDINARY } from './cloudinary.constants.js';
import { CloudinaryService, type CloudinaryClient } from './cloudinary.service.js';

@Global()
@Module({
  providers: [
    {
      provide: CLOUDINARY,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): CloudinaryClient => {
        const cloudName = config.get('CLOUDINARY_CLOUD_NAME', { infer: true });
        const apiKey = config.get('CLOUDINARY_API_KEY', { infer: true });
        const apiSecret = config.get('CLOUDINARY_API_SECRET', { infer: true });

        if (!cloudName || !apiKey || !apiSecret) {
          new Logger('CloudinaryModule').warn(
            'Chưa cấu hình CLOUDINARY_* — tính năng tải ảnh cận lâm sàng sẽ bị tắt.',
          );
          return null;
        }

        cloudinary.config({
          cloud_name: cloudName,
          api_key: apiKey,
          api_secret: apiSecret,
          secure: true,
        });
        return cloudinary;
      },
    },
    CloudinaryService,
  ],
  exports: [CloudinaryService, CLOUDINARY],
})
export class CloudinaryModule {}
