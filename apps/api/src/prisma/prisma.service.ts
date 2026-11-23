import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Env } from '../config/env.validation.js';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService<Env, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('DATABASE_URL', { infer: true }),
        // Số kết nối tối đa tới PostgreSQL của mỗi instance (mặc định 10). Gói CSDL miễn phí thường
        // giới hạn tổng số kết nối — xem docs/testing.md phần kiểm thử tải.
        max: config.get('DATABASE_POOL_MAX', { infer: true }),
      }),
    });
  }

  /** Kết nối được tạo khi có truy vấn đầu tiên, nên API vẫn khởi động được khi DB tạm thời chưa sẵn sàng. */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
