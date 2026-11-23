import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AccessTokenPayload, AuthUser } from '../auth.types.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { UserStatusService } from '../user-status.service.js';

/** Guard toàn cục: mọi route yêu cầu access token hợp lệ, trừ route gắn `@Public()`. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly status: UserStatusService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Socket.io xác thực một lần khi mở kết nối (vé socket, xem RealtimeGateway) — guard này chỉ cho HTTP
    if (context.getType() !== 'http') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Chưa đăng nhập');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    }
    // Tài khoản bị khoá sau khi cấp token: chặn ngay, không đợi token hết hạn
    if (!(await this.status.isActive(payload.sub)))
      throw new UnauthorizedException('Tài khoản đã bị khoá');
    request.user = {
      id: payload.sub,
      role: payload.role,
      facilityId: payload.fid ?? null,
      patientId: payload.pid ?? null,
    };
    return true;
  }
}
