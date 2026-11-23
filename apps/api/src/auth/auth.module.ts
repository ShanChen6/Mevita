import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Env } from '../config/env.validation.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { TokenService } from './token.service.js';
import { UserStatusService } from './user-status.service.js';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: { algorithm: 'HS256', issuer: 'mevita-api', audience: 'mevita' },
        verifyOptions: { algorithms: ['HS256'], issuer: 'mevita-api', audience: 'mevita' },
      }),
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
      // Tắt giới hạn tần suất khi chạy test tự động
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    UserStatusService,
    // Thứ tự quan trọng: xác thực trước, kiểm tra vai trò sau
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [UserStatusService],
})
export class AuthModule {}
