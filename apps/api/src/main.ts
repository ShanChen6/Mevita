import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { RealtimeIoAdapter } from './realtime/realtime-io.adapter.js';
import type { Env } from './config/env.validation.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Tin header X-Forwarded-For từ 1 lớp proxy (Render/Railway) để lấy đúng IP người dùng
  app.set('trust proxy', 1);
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.disable('x-powered-by');
  // Header bảo mật cơ bản cho API JSON (không phục vụ HTML)
  app.use((_req: unknown, res: { setHeader(k: string, v: string): void }, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    if (config.get('NODE_ENV', { infer: true }) === 'production')
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.get('CORS_ORIGIN', { infer: true }).split(','),
    credentials: true,
  });
  app.enableShutdownHooks();
  app.useWebSocketAdapter(new RealtimeIoAdapter(app));

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`Mevita API đang chạy tại http://localhost:${port}/api`, 'Bootstrap');
}
await bootstrap();
