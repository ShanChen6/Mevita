import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SocketUser } from './realtime.events.js';

/** Vé socket chỉ dùng để mở kết nối realtime, khác audience với access token. */
const AUDIENCE = 'mevita-socket';
export const TICKET_TTL_SECONDS = 60;

interface TicketPayload {
  sub: string;
  role: SocketUser['role'];
  fid?: string;
  name: string;
  title?: string;
}

/**
 * Cấp vé ngắn hạn để trình duyệt mở kết nối Socket.io. Web giữ access token trong cookie httpOnly
 * (JavaScript không đọc được), nên máy chủ web đổi access token lấy vé này cho trình duyệt.
 */
@Injectable()
export class RealtimeTicketService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async issue(user: AuthUser) {
    const u = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        isActive: true,
        fullName: true,
        staffProfile: { select: { academicTitle: true, facilityId: true } },
      },
    });
    if (!u?.isActive) throw new UnauthorizedException('Tài khoản không còn hoạt động');
    const payload: TicketPayload = {
      sub: user.id,
      role: user.role,
      ...(u.staffProfile?.facilityId && { fid: u.staffProfile.facilityId }),
      name: u.fullName,
      ...(u.staffProfile?.academicTitle && { title: u.staffProfile.academicTitle }),
    };
    const ticket = await this.jwt.signAsync(payload, {
      audience: AUDIENCE,
      expiresIn: TICKET_TTL_SECONDS,
    });
    return { ticket, expiresAt: new Date(Date.now() + TICKET_TTL_SECONDS * 1000).toISOString() };
  }

  /** Xác minh vé khi mở kết nối. Access token thường (audience khác) bị từ chối. */
  async verify(token: unknown): Promise<SocketUser> {
    if (typeof token !== 'string' || token.length > 2048) throw new Error('unauthorized');
    try {
      const p = await this.jwt.verifyAsync<TicketPayload>(token, { audience: AUDIENCE });
      return {
        id: p.sub,
        role: p.role,
        facilityId: p.fid ?? null,
        fullName: p.name,
        academicTitle: p.title ?? null,
      };
    } catch {
      throw new Error('unauthorized');
    }
  }
}
