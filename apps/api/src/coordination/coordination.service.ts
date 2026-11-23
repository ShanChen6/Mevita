import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeEvent } from '../realtime/realtime.events.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import type { CapacityInput } from '../referrals/referrals.schemas.js';
import { AuditService } from '../audit/audit.service.js';
import { loadLevel } from './capacity.js';

const capacitySelect = {
  id: true,
  name: true,
  erBedsTotal: true,
  erBedsAvailable: true,
  icuBedsAvailable: true,
  capacityNote: true,
  capacityUpdatedAt: true,
  acceptsReferrals: true,
} as const;

/** Năng lực tiếp nhận & tổng quan điều phối (Task B). */
@Injectable()
export class CoordinationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly audit: AuditService,
  ) {}

  private withLoad<T extends Parameters<typeof loadLevel>[0]>(f: T) {
    const { level, stale } = loadLevel(f);
    return { ...f, load: level, capacityStale: stale };
  }

  async myCapacity(user: AuthUser) {
    if (!user.facilityId) throw new BadRequestException('Tài khoản chưa gắn cơ sở công tác');
    const f = await this.prisma.healthFacility.findUniqueOrThrow({
      where: { id: user.facilityId },
      select: capacitySelect,
    });
    return this.withLoad(f);
  }

  /** Bệnh viện nhận chuyển tuyến tự cập nhật số giường; báo điều phối viên Sở Y tế. */
  async updateCapacity(user: AuthUser, input: CapacityInput) {
    const current = await this.myCapacity(user);
    if (!current.acceptsReferrals)
      throw new ForbiddenException('Chỉ bệnh viện nhận chuyển tuyến cập nhật năng lực');
    const f = await this.prisma.healthFacility.update({
      where: { id: current.id },
      data: { ...input, capacityUpdatedAt: new Date() },
      select: capacitySelect,
    });
    const result = this.withLoad(f);
    await this.audit.log({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'FacilityCapacity',
      entityId: f.id,
      metadata: { ...input },
    });
    this.realtime.emitToAdmins(RealtimeEvent.CapacityUpdate, {
      id: f.id,
      name: f.name,
      load: result.load,
      erBedsAvailable: f.erBedsAvailable,
      erBedsTotal: f.erBedsTotal,
    });
    return result;
  }

  /** Tổng quan cho điều phối viên Sở Y tế: năng lực bệnh viện, ca chậm phản hồi, xe đang chạy. */
  async overview() {
    const [hospitals, waiting, vehicles] = await Promise.all([
      this.prisma.healthFacility.findMany({
        where: { isActive: true, acceptsReferrals: true },
        select: {
          ...capacitySelect,
          emergencyPhone: true,
          phone: true,
          latitude: true,
          longitude: true,
          commune: { select: { province: { select: { name: true } } } },
          _count: {
            select: { incomingReferrals: { where: { status: { in: ['PENDING', 'ACCEPTED'] } } } },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.referral.findMany({
        where: { status: 'PENDING', priority: { in: ['CRITICAL', 'URGENT'] } },
        select: {
          id: true,
          code: true,
          priority: true,
          createdAt: true,
          escalationLevel: true,
          reason: true,
          fromFacility: { select: { name: true, emergencyPhone: true, phone: true } },
          toFacility: { select: { name: true, emergencyPhone: true, phone: true } },
        },
        orderBy: [{ escalationLevel: 'desc' }, { createdAt: 'asc' }],
        take: 50,
      }),
      this.prisma.vehicle.findMany({
        where: { status: 'ON_MISSION' },
        select: {
          id: true,
          plateNumber: true,
          type: true,
          lastLatitude: true,
          lastLongitude: true,
          lastSeenAt: true,
          facility: { select: { name: true } },
          referrals: {
            where: { status: { in: ['PENDING', 'ACCEPTED'] } },
            select: {
              code: true,
              priority: true,
              toFacility: { select: { name: true } },
              estimatedArrivalAt: true,
            },
            take: 1,
          },
        },
      }),
    ]);
    return {
      hospitals: hospitals.map(({ _count, commune, ...h }) => ({
        ...this.withLoad(h),
        province: commune.province.name,
        onDutyCount: this.realtime.presence.onDuty(h.id).length,
        activeIncoming: _count.incomingReferrals,
      })),
      waiting: waiting.map((r) => ({
        ...r,
        waitedMinutes: Math.floor((Date.now() - r.createdAt.getTime()) / 60_000),
      })),
      vehicles: vehicles.map(({ referrals, ...v }) => ({ ...v, mission: referrals[0] ?? null })),
    };
  }
}
