import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../config/env.validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AccessTokenPayload, AuthUser, TokenPair } from './auth.types.js';

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export interface SessionContext {
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Cấp access token (JWT ngắn hạn) và refresh token (chuỗi ngẫu nhiên, lưu dạng băm trong DB).
 * Refresh token được xoay vòng mỗi lần dùng; nếu một token đã bị thu hồi lại được gửi lên
 * (dấu hiệu bị đánh cắp), toàn bộ phiên của tài khoản bị thu hồi.
 *
 * Ngoại lệ: token vừa bị xoay vòng trong vòng `REFRESH_REUSE_GRACE_SECONDS` vẫn được chấp nhận,
 * vì trình duyệt thường gửi nhiều request song song (điều hướng + prefetch) cùng một refresh token
 * ngay khi access token hết hạn. Token đã đăng xuất (không có `rotatedAt`) không được ân hạn.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async issue(user: AuthUser, ctx: SessionContext = {}): Promise<TokenPair> {
    const ttl = this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true });
    const payload: AccessTokenPayload = {
      sub: user.id,
      role: user.role,
      ...(user.facilityId && { fid: user.facilityId }),
      ...(user.patientId && { pid: user.patientId }),
    };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: ttl });

    const refreshToken = randomBytes(32).toString('base64url');
    const refreshDays = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
    const refreshTokenExpiresAt = new Date(Date.now() + refreshDays * 86_400_000);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: refreshTokenExpiresAt,
        userAgent: ctx.userAgent?.slice(0, 500),
        ipAddress: ctx.ipAddress?.slice(0, 45),
      },
    });

    return {
      accessToken,
      accessTokenExpiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
      refreshToken,
      refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
    };
  }

  /**
   * Thu hồi refresh token đang dùng và trả về userId để cấp cặp token mới.
   * Ném lỗi nếu token không tồn tại, hết hạn hoặc đã bị dùng (khi đó thu hồi mọi phiên).
   */
  async consume(refreshToken: string): Promise<{ userId: string; reused: boolean }> {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored) throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');

    if (stored.expiresAt <= new Date()) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
    }
    if (stored.revokedAt) return this.handleRevoked(stored.id, stored.userId);

    // Thu hồi có điều kiện: chỉ một request đổi được token; request song song đi nhánh ân hạn
    const now = new Date();
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: now, rotatedAt: now },
    });
    if (count === 0) return this.handleRevoked(stored.id, stored.userId);
    return { userId: stored.userId, reused: false };
  }

  private async handleRevoked(
    id: string,
    userId: string,
  ): Promise<{ userId: string; reused: boolean }> {
    const token = await this.prisma.refreshToken.findUnique({
      where: { id },
      select: { rotatedAt: true },
    });
    const graceMs = this.config.get('REFRESH_REUSE_GRACE_SECONDS', { infer: true }) * 1000;
    if (token?.rotatedAt && Date.now() - token.rotatedAt.getTime() < graceMs) {
      return { userId, reused: false };
    }
    await this.revokeAll(userId);
    return { userId, reused: true };
  }

  /** Thu hồi một refresh token, trả về chủ sở hữu (nếu token còn hiệu lực). */
  async revoke(refreshToken: string): Promise<string | null> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      select: { id: true, userId: true, revokedAt: true },
    });
    if (!stored || stored.revokedAt) return null;
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return stored.userId;
  }

  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
