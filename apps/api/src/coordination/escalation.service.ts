import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service.js';
import type { Env } from '../config/env.validation.js';
import type { ReferralPriority } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeEvent } from '../realtime/realtime.events.js';
import { RealtimeService } from '../realtime/realtime.service.js';

/** Sau bao nhiêu phút chưa có ai xác nhận thì leo thang (ca thường không leo thang) */
export const ESCALATION_MINUTES: Record<ReferralPriority, number | null> = {
  CRITICAL: 3,
  URGENT: 10,
  ROUTINE: null,
};

/**
 * Leo thang khi bệnh viện nhận chậm phản hồi (Task B):
 * - Mức 1 (quá ngưỡng): nhắc lại kíp trực của bệnh viện (popup + còi), báo tuyến dưới gọi đường dây nóng.
 * - Mức 2 (gấp đôi ngưỡng): báo điều phối viên Sở Y tế (phòng `admins`) và tuyến dưới.
 * Cập nhật có điều kiện theo mức hiện tại → nhiều instance API chạy cùng lúc không leo thang trùng.
 */
@Injectable()
export class EscalationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EscalationService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit() {
    const ms = this.config.get('ESCALATION_INTERVAL_MS', { infer: true });
    // Kiểm thử tự động gọi run() trực tiếp để kiểm soát thời gian
    if (ms > 0 && this.config.get('NODE_ENV', { infer: true }) !== 'test')
      this.timer = setInterval(
        () => void this.run().catch((e: unknown) => this.logger.error(e)),
        ms,
      );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Quét và leo thang các ca quá hạn phản hồi; trả số ca đã leo thang. */
  async run(now = new Date()) {
    const pending = await this.prisma.referral.findMany({
      where: {
        status: 'PENDING',
        priority: { in: ['CRITICAL', 'URGENT'] },
        escalationLevel: { lt: 2 },
      },
      select: {
        id: true,
        code: true,
        priority: true,
        createdAt: true,
        reason: true,
        escalationLevel: true,
        fromFacility: { select: { id: true, name: true } },
        toFacility: { select: { id: true, name: true, emergencyPhone: true, phone: true } },
        patient: {
          select: {
            fullName: true,
            dateOfBirth: true,
            gender: true,
            allergies: true,
            bloodType: true,
          },
        },
      },
    });
    let escalated = 0;
    for (const r of pending) {
      const limit = ESCALATION_MINUTES[r.priority];
      if (limit == null) continue;
      const waited = (now.getTime() - r.createdAt.getTime()) / 60_000;
      const level = waited >= 2 * limit ? 2 : waited >= limit ? 1 : 0;
      if (level <= r.escalationLevel) continue;
      const { count } = await this.prisma.referral.updateMany({
        where: { id: r.id, status: 'PENDING', escalationLevel: r.escalationLevel },
        data: { escalationLevel: level, escalatedAt: now },
      });
      if (count === 0) continue; // instance khác đã xử lý / ca vừa được tiếp nhận
      escalated++;
      const payload = {
        id: r.id,
        code: r.code,
        priority: r.priority,
        level,
        waitedMinutes: Math.floor(waited),
        fromFacility: r.fromFacility.name,
        toFacility: r.toFacility.name,
        toFacilityPhone: r.toFacility.emergencyPhone ?? r.toFacility.phone,
      };
      // Nhắc lại bệnh viện nhận bằng popup + còi như ca mới
      await this.realtime.emitToFacility(r.toFacility.id, RealtimeEvent.NewIncomingReferral, {
        id: r.id,
        code: r.code,
        priority: r.priority,
        createdAt: r.createdAt,
        estimatedArrivalAt: null,
        reason: r.reason,
        patient: r.patient,
        diagnosis: null,
        fromFacility: { name: r.fromFacility.name, province: '' },
        referredBy: null,
        escalated: level,
        waitedMinutes: Math.floor(waited),
      });
      await this.realtime.emitToFacility(
        r.fromFacility.id,
        RealtimeEvent.ReferralEscalated,
        payload,
      );
      if (level === 2) this.realtime.emitToAdmins(RealtimeEvent.ReferralEscalated, payload);
      await this.audit.log({
        action: 'ESCALATE',
        entityType: 'Referral',
        entityId: r.id,
        metadata: { level, waitedMinutes: Math.floor(waited) },
      });
    }
    return escalated;
  }
}
