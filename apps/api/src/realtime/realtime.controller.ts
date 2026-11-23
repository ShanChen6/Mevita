import { BadRequestException, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeTicketService } from './realtime-ticket.service.js';
import { NAMESPACE, RealtimeEvent } from './realtime.events.js';
import { RealtimeService } from './realtime.service.js';

@Controller('realtime')
export class RealtimeController {
  constructor(
    private readonly tickets: RealtimeTicketService,
    private readonly realtime: RealtimeService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Vé mở kết nối Socket.io (hiệu lực 60 giây) */
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post('ticket')
  async ticket(@CurrentUser() user: AuthUser) {
    return { ...(await this.tickets.issue(user)), namespace: NAMESPACE };
  }

  /** Nhân viên đang trực tại cơ sở của mình */
  @Roles('COMMUNE_STAFF', 'PROVINCE_STAFF')
  @Get('presence')
  presence(@CurrentUser() user: AuthUser) {
    const facilityId = this.requireFacility(user);
    return { facilityId, onDuty: this.realtime.presence.onDuty(facilityId) };
  }

  /** Kiểm tra kênh trực: gửi tín hiệu tới mọi đồng nghiệp đang trực cùng cơ sở */
  @Roles('COMMUNE_STAFF', 'PROVINCE_STAFF')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @HttpCode(200)
  @Post('test-signal')
  async testSignal(@CurrentUser() user: AuthUser) {
    const facilityId = this.requireFacility(user);
    const sender = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { fullName: true, staffProfile: { select: { academicTitle: true } } },
    });
    const sentAt = new Date().toISOString();
    const delivered = await this.realtime.emitToFacility(facilityId, RealtimeEvent.ChannelTest, {
      facilityId,
      from: {
        id: user.id,
        fullName: sender.fullName,
        academicTitle: sender.staffProfile?.academicTitle ?? null,
      },
      sentAt,
    });
    await this.audit.log({
      userId: user.id,
      action: 'CREATE',
      entityType: 'RealtimeTest',
      entityId: facilityId,
      metadata: { delivered },
    });
    return { delivered, sentAt };
  }

  private requireFacility(user: AuthUser) {
    if (!user.facilityId) throw new BadRequestException('Tài khoản chưa gắn cơ sở công tác');
    return user.facilityId;
  }
}
