import type { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';
import type { Env } from '../config/env.validation.js';

/** Socket.io dùng cùng danh sách origin với HTTP, giới hạn gói tin 64 KB. */
export class RealtimeIoAdapter extends IoAdapter {
  constructor(private readonly ctx: INestApplicationContext) {
    super(ctx);
  }

  override createIOServer(
    port: number,
    options?: ServerOptions,
  ): ReturnType<IoAdapter['createIOServer']> {
    const origins = this.ctx
      .get<ConfigService<Env, true>>(ConfigService)
      .get('CORS_ORIGIN', { infer: true })
      .split(',');
    const merged: Partial<ServerOptions> = {
      ...options,
      cors: { origin: origins, credentials: true },
      maxHttpBufferSize: 64 * 1024,
      pingInterval: 20_000,
      pingTimeout: 20_000,
    };
    return super.createIOServer(port, merged as ServerOptions);
  }
}
