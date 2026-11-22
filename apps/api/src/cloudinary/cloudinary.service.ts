import { Inject, Injectable, Logger } from '@nestjs/common';
import type { v2 } from 'cloudinary';
import { CLOUDINARY } from './cloudinary.constants.js';

export type CloudinaryClient = typeof v2 | null;

export type CloudinaryStatus = 'connected' | 'not_configured' | 'error';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(@Inject(CLOUDINARY) private readonly client: CloudinaryClient) {}

  get isConfigured(): boolean {
    return this.client !== null;
  }

  /** Gọi Admin API `ping` để xác nhận thông tin đăng nhập Cloudinary hợp lệ. */
  async ping(): Promise<CloudinaryStatus> {
    if (!this.client) return 'not_configured';
    try {
      const res = (await this.client.api.ping()) as { status?: string };
      return res.status === 'ok' ? 'connected' : 'error';
    } catch (error) {
      this.logger.warn(`Không kết nối được Cloudinary: ${(error as Error).message}`);
      return 'error';
    }
  }
}
