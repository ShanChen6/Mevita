import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { hasCoords, haversineKm, travelMinutes, type LatLng } from '../common/geo.js';
import { addMinutes } from '../common/vn-time.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeEvent } from '../realtime/realtime.events.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import type { LocationEntryInput } from './referrals.schemas.js';
import { referralSelect, ReferralsService } from './referrals.service.js';
import { AMBULANCES, recommendation } from './transport.js';

const ACTIVE = ['PENDING', 'ACCEPTED'] as const;
/** Bán kính tìm cơ sở có xe để đón bệnh nhân (km, đường chim bay) */
const PICKUP_RADIUS_KM = 150;
/** Xe vào bán kính này quanh bệnh viện nhận → báo "xe sắp tới" */
const ARRIVING_RADIUS_KM = 1;
/** Thời gian bàn giao bệnh nhân lên xe đón (phút) */
const HANDOVER_MINUTES = 5;
const LATE_SYNC_MS = 3600_000;
/** Tốc độ lớn hơn coi là nhiễu GPS (km/h) */
const MAX_PLAUSIBLE_KMH = 150;

const facilityGeo = {
  id: true,
  name: true,
  phone: true,
  emergencyPhone: true,
  latitude: true,
  longitude: true,
} as const;

/**
 * Xe chuyển viện & vị trí thời gian thực (Task C).
 * - Gợi ý phương tiện, yêu cầu xe đón → cơ sở đầu tiên nhận được giao ca (chống nhận trùng).
 * - Điện thoại trên xe gửi vị trí (idempotent theo clientId như sinh tồn): tính lại giờ tới theo vị trí thật,
 *   báo bệnh viện khi xe vào bán kính 1 km.
 */
@Injectable()
export class TransportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly referrals: ReferralsService,
    private readonly audit: AuditService,
  ) {}

  private async myFacility(user: AuthUser) {
    if (!user.facilityId) throw new BadRequestException('Tài khoản chưa gắn cơ sở công tác');
    return this.prisma.healthFacility.findUniqueOrThrow({
      where: { id: user.facilityId },
      select: facilityGeo,
    });
  }

  /** Cơ sở có xe cứu thương sẵn sàng quanh `origin`, gần nhất trước. */
  private async pickupCandidates(origin: LatLng | null, excludeId: string, includeId?: string) {
    const facilities = await this.prisma.healthFacility.findMany({
      where: {
        isActive: true,
        id: { not: excludeId },
        vehicles: { some: { isActive: true, status: 'AVAILABLE', type: { in: AMBULANCES } } },
      },
      select: {
        ...facilityGeo,
        vehicles: {
          where: { isActive: true, status: 'AVAILABLE', type: { in: AMBULANCES } },
          select: { type: true },
        },
      },
    });
    return facilities
      .map(({ vehicles, ...f }) => {
        const distanceKm = origin && hasCoords(f) ? haversineKm(origin, f) : null;
        return {
          ...f,
          distanceKm: distanceKm == null ? null : Math.round(distanceKm * 10) / 10,
          pickupMinutes: distanceKm == null ? null : travelMinutes(distanceKm),
          advanced: vehicles.filter((v) => v.type === 'ADVANCED_AMBULANCE').length,
          basic: vehicles.filter((v) => v.type === 'BASIC_AMBULANCE').length,
        };
      })
      .filter(
        (f) => f.id === includeId || (f.distanceKm != null && f.distanceKm <= PICKUP_RADIUS_KM),
      )
      .sort((a, b) => (a.pickupMinutes ?? 9999) - (b.pickupMinutes ?? 9999));
  }

  /** Phương án vận chuyển cho form lệnh chuyển tuyến. */
  async options(user: AuthUser, toFacilityId?: string) {
    const from = await this.myFacility(user);
    const [vehicles, to] = await Promise.all([
      this.prisma.vehicle.findMany({
        where: { facilityId: from.id, isActive: true },
        select: {
          id: true,
          plateNumber: true,
          type: true,
          equipment: true,
          status: true,
          driverName: true,
        },
        orderBy: [{ status: 'asc' }, { type: 'asc' }],
      }),
      toFacilityId
        ? this.prisma.healthFacility.findUnique({
            where: { id: toFacilityId },
            select: facilityGeo,
          })
        : null,
    ]);
    const origin = hasCoords(from) ? from : null;
    const candidates = await this.pickupCandidates(origin, from.id, to?.id);
    const transportKm = origin && to && hasCoords(to) ? haversineKm(origin, to) : null;
    return {
      origin: origin ? { latitude: origin.latitude, longitude: origin.longitude } : null,
      recommendation: {
        CRITICAL: recommendation('CRITICAL'),
        URGENT: recommendation('URGENT'),
        ROUTINE: recommendation('ROUTINE'),
      },
      ownVehicles: vehicles,
      pickupCandidates: candidates.slice(0, 5),
      transportKm: transportKm == null ? null : Math.round(transportKm * 10) / 10,
      transportMinutes: transportKm == null ? null : travelMinutes(transportKm),
    };
  }

  /** Gửi yêu cầu xe đón tới bệnh viện nhận + cơ sở lân cận có xe. Trả số kết nối đã nhận. */
  async broadcastPickupRequest(referralId: string) {
    const r = await this.prisma.referral.findUniqueOrThrow({
      where: { id: referralId },
      select: {
        id: true,
        code: true,
        priority: true,
        reason: true,
        createdAt: true,
        fromFacility: { select: facilityGeo },
        toFacility: { select: { id: true, name: true } },
      },
    });
    const origin = hasCoords(r.fromFacility) ? r.fromFacility : null;
    const candidates = await this.pickupCandidates(origin, r.fromFacility.id, r.toFacility.id);
    const targets = new Set([r.toFacility.id, ...candidates.map((c) => c.id)]);
    let delivered = 0;
    for (const id of targets) {
      const c = candidates.find((x) => x.id === id);
      delivered += await this.realtime.emitToFacility(id, RealtimeEvent.PickupRequest, {
        id: r.id,
        code: r.code,
        priority: r.priority,
        reason: r.reason,
        createdAt: r.createdAt,
        fromFacility: {
          name: r.fromFacility.name,
          phone: r.fromFacility.emergencyPhone ?? r.fromFacility.phone,
        },
        toFacility: r.toFacility.name,
        distanceKm: c?.distanceKm ?? null,
      });
    }
    return { delivered, facilities: targets.size };
  }

  /** Yêu cầu xe đón đang mở mà cơ sở của người dùng có thể nhận (có xe sẵn sàng, trong bán kính hoặc là BV nhận). */
  async pickupRequests(user: AuthUser) {
    const me = await this.myFacility(user);
    const available = await this.prisma.vehicle.count({
      where: { facilityId: me.id, isActive: true, status: 'AVAILABLE', type: { in: AMBULANCES } },
    });
    const open = await this.prisma.referral.findMany({
      where: {
        transportMode: 'PICKUP',
        vehicleId: null,
        status: { in: [...ACTIVE] },
        createdAt: { gte: new Date(Date.now() - 6 * 3600_000) },
        fromFacilityId: { not: me.id },
      },
      select: {
        id: true,
        code: true,
        priority: true,
        reason: true,
        createdAt: true,
        toFacilityId: true,
        fromFacility: { select: { ...facilityGeo, commune: { select: { fullName: true } } } },
        toFacility: { select: { id: true, name: true } },
        patient: { select: { gender: true, dateOfBirth: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const rank = { CRITICAL: 0, URGENT: 1, ROUTINE: 2 } as const;
    return open
      .map((r) => {
        const d =
          hasCoords(me) && hasCoords(r.fromFacility) ? haversineKm(me, r.fromFacility) : null;
        return {
          ...r,
          distanceKm: d == null ? null : Math.round(d * 10) / 10,
          pickupMinutes: d == null ? null : travelMinutes(d),
          isDestination: r.toFacilityId === me.id,
        };
      })
      .filter(
        (r) =>
          r.isDestination ||
          (available > 0 && r.distanceKm != null && r.distanceKm <= PICKUP_RADIUS_KM),
      )
      .sort((a, b) => rank[a.priority] - rank[b.priority] || +a.createdAt - +b.createdAt)
      .map(({ toFacilityId: _t, ...r }) => ({ ...r, canDispatch: available > 0 }));
  }

  /** Cử xe đón: cơ sở đầu tiên bấm được giao ca, các cơ sở khác nhận thông báo đóng yêu cầu. */
  async dispatch(id: string, user: AuthUser, vehicleId: string) {
    const me = await this.myFacility(user);
    const [vehicle, r] = await Promise.all([
      this.prisma.vehicle.findFirst({
        where: { id: vehicleId, facilityId: me.id, isActive: true },
        select: { id: true, type: true, status: true, plateNumber: true },
      }),
      this.prisma.referral.findUnique({
        where: { id },
        select: {
          priority: true,
          transportMode: true,
          vehicleId: true,
          status: true,
          fromFacility: { select: facilityGeo },
          toFacility: { select: facilityGeo },
        },
      }),
    ]);
    if (!r || r.transportMode !== 'PICKUP') throw new NotFoundException('Không có yêu cầu xe đón');
    if (!vehicle) throw new BadRequestException('Xe không thuộc cơ sở');
    if (r.priority !== 'ROUTINE' && !AMBULANCES.includes(vehicle.type))
      throw new BadRequestException('Ca cấp cứu cần xe cứu thương');
    const now = new Date();
    const pickupLeg =
      hasCoords(me) && hasCoords(r.fromFacility)
        ? travelMinutes(haversineKm(me, r.fromFacility))
        : null;
    const transportLeg =
      hasCoords(r.fromFacility) && hasCoords(r.toFacility)
        ? travelMinutes(haversineKm(r.fromFacility, r.toFacility))
        : null;
    await this.prisma.$transaction(async (tx) => {
      const booked = await tx.vehicle.updateMany({
        where: { id: vehicle.id, status: 'AVAILABLE' },
        data: { status: 'ON_MISSION' },
      });
      if (booked.count === 0) throw new ConflictException('Xe đang làm nhiệm vụ hoặc bảo trì');
      const taken = await tx.referral.updateMany({
        where: { id, transportMode: 'PICKUP', vehicleId: null, status: { in: [...ACTIVE] } },
        data: {
          vehicleId: vehicle.id,
          pickupAssignedAt: now,
          ...(pickupLeg != null &&
            transportLeg != null && {
              estimatedArrivalAt: addMinutes(now, pickupLeg + HANDOVER_MINUTES + transportLeg),
            }),
        },
      });
      if (taken.count === 0)
        throw new ConflictException('Yêu cầu này đã có cơ sở khác nhận hoặc ca đã kết thúc');
    });
    const updated = await this.prisma.referral.findUniqueOrThrow({
      where: { id },
      select: referralSelect,
    });
    await this.referrals.notifyChange(updated, user, 'dispatch');
    // Đóng yêu cầu ở các cơ sở khác
    const candidates = await this.pickupCandidates(
      hasCoords(r.fromFacility) ? r.fromFacility : null,
      r.fromFacility.id,
      r.toFacility.id,
    );
    for (const f of new Set([r.toFacility.id, ...candidates.map((c) => c.id), me.id]))
      await this.realtime.emitToFacility(f, RealtimeEvent.PickupClosed, {
        id,
        code: updated.code,
        assignedTo: me.name,
        plateNumber: vehicle.plateNumber,
      });
    await this.audit.log({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Referral',
      entityId: id,
      metadata: { action: 'dispatch', vehicleId: vehicle.id, pickupMinutes: pickupLeg },
    });
    return { referral: this.referrals.toDto(updated), pickupMinutes: pickupLeg };
  }

  /** Xe đón đã tới trạm và nhận bệnh nhân — bắt đầu chặng chở bệnh nhân. */
  async pickedUp(id: string, user: AuthUser) {
    const r = await this.prisma.referral.findUnique({
      where: { id },
      select: {
        transportMode: true,
        vehicleId: true,
        pickedUpAt: true,
        status: true,
        vehicle: { select: { facilityId: true } },
        fromFacility: { select: facilityGeo },
        toFacility: { select: facilityGeo },
      },
    });
    if (!r || (user.facilityId !== r.fromFacility.id && user.facilityId !== r.vehicle?.facilityId))
      throw new NotFoundException('Không tìm thấy phiếu chuyển tuyến');
    if (r.transportMode !== 'PICKUP' || !r.vehicleId)
      throw new ConflictException('Ca này chưa có xe đón');
    const now = new Date();
    const leg =
      hasCoords(r.fromFacility) && hasCoords(r.toFacility)
        ? travelMinutes(haversineKm(r.fromFacility, r.toFacility))
        : null;
    const { count } = await this.prisma.referral.updateMany({
      where: { id, pickedUpAt: null, status: { in: [...ACTIVE] } },
      data: {
        pickedUpAt: now,
        departedAt: now,
        ...(leg != null && { estimatedArrivalAt: addMinutes(now, leg) }),
      },
    });
    if (count === 0) throw new ConflictException('Đã ghi nhận đón bệnh nhân hoặc ca đã kết thúc');
    const updated = await this.prisma.referral.findUniqueOrThrow({
      where: { id },
      select: referralSelect,
    });
    await this.referrals.notifyChange(updated, user, 'picked_up');
    return this.referrals.toDto(updated);
  }

  /** Lộ trình đã ghi (cũ → mới) — cơ sở gửi, nhận hoặc cơ sở có xe. */
  async locations(id: string, user: AuthUser) {
    const r = await this.prisma.referral.findUnique({
      where: { id },
      select: {
        fromFacilityId: true,
        toFacilityId: true,
        vehicle: { select: { facilityId: true } },
      },
    });
    const ok =
      r &&
      (user.role === 'ADMIN' ||
        (!!user.facilityId &&
          [r.fromFacilityId, r.toFacilityId, r.vehicle?.facilityId].includes(user.facilityId)));
    if (!r || !ok) throw new NotFoundException('Không tìm thấy phiếu chuyển tuyến');
    return this.prisma.referralLocation.findMany({
      where: { referralId: id },
      select: {
        clientId: true,
        latitude: true,
        longitude: true,
        recordedAt: true,
        speed: true,
        accuracy: true,
      },
      orderBy: { recordedAt: 'asc' },
    });
  }

  /**
   * Ghi lô vị trí từ điện thoại trên xe; tính lại giờ tới theo vị trí thật và báo "xe sắp tới".
   * Chặng xe đón (chưa đón bệnh nhân): giờ tới = tới trạm + bàn giao + chặng chở bệnh nhân.
   */
  async recordLocations(
    id: string,
    user: Pick<AuthUser, 'id' | 'facilityId'>,
    entries: LocationEntryInput[],
  ) {
    const r = await this.prisma.referral.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        status: true,
        arrivedAt: true,
        escortId: true,
        transportMode: true,
        pickedUpAt: true,
        arrivingNotifiedAt: true,
        vehicleId: true,
        vehicle: { select: { facilityId: true } },
        fromFacility: { select: facilityGeo },
        toFacility: { select: facilityGeo },
      },
    });
    if (!r) throw new NotFoundException('Không tìm thấy phiếu chuyển tuyến');
    const allowed =
      r.escortId === user.id ||
      (!!user.facilityId && [r.fromFacility.id, r.vehicle?.facilityId].includes(user.facilityId));
    if (!allowed)
      throw new ForbiddenException('Chỉ người trên xe / cơ sở chuyển đi mới gửi được vị trí');
    const active = r.status === 'PENDING' || r.status === 'ACCEPTED';
    const late =
      r.status === 'ARRIVED' && !!r.arrivedAt && Date.now() - r.arrivedAt.getTime() < LATE_SYNC_MS;
    if (!active && !late)
      throw new ConflictException('Ca chuyển tuyến đã kết thúc, ngừng chia sẻ vị trí');
    const now = Date.now();
    if (entries.some((e) => Date.parse(e.recordedAt) > now + 5 * 60_000))
      throw new BadRequestException('Thời điểm không hợp lệ — kiểm tra đồng hồ thiết bị');

    const existing = await this.prisma.referralLocation.findMany({
      where: { clientId: { in: entries.map((e) => e.clientId) } },
      select: { clientId: true, referralId: true },
    });
    if (existing.some((x) => x.referralId !== id))
      throw new ConflictException('Mã bản ghi trùng với phiếu khác');
    const seen = new Set(existing.map((x) => x.clientId));
    const fresh = entries.filter((e) => !seen.has(e.clientId) && !!seen.add(e.clientId));
    const accepted = entries.map((e) => e.clientId);
    if (fresh.length === 0) return { accepted, created: 0, etaAt: null };

    const previous = await this.prisma.referralLocation.findFirst({
      where: { referralId: id },
      orderBy: { recordedAt: 'desc' },
      select: { latitude: true, longitude: true, recordedAt: true },
    });
    await this.prisma.referralLocation.createMany({
      data: fresh.map((e) => ({
        ...e,
        referralId: id,
        recordedAt: new Date(e.recordedAt),
        recordedById: user.id,
      })),
      skipDuplicates: true,
    });
    const latest = [...fresh].sort(
      (a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt),
    )[0];
    const latestAt = new Date(latest.recordedAt);

    // Tốc độ: từ GPS (m/s) nếu có, không thì từ quãng đường giữa 2 điểm gần nhất
    const gpsSpeeds = fresh.map((e) => e.speed).filter((v): v is number => v != null && v > 0.5);
    let speedKmh: number | undefined = gpsSpeeds.length
      ? (gpsSpeeds.reduce((a, b) => a + b, 0) / gpsSpeeds.length) * 3.6
      : undefined;
    if (speedKmh == null && previous && latestAt > previous.recordedAt) {
      const hours = (latestAt.getTime() - previous.recordedAt.getTime()) / 3600_000;
      const km = haversineKm(previous, latest);
      if (hours > 0 && km > 0.05) speedKmh = km / hours;
    }
    // GPS nhảy điểm (nhiễu, vừa bật lại) cho tốc độ phi thực tế → bỏ, dùng tốc độ mặc định
    if (speedKmh != null && speedKmh > MAX_PLAUSIBLE_KMH) speedKmh = undefined;

    const pickupPhase = r.transportMode === 'PICKUP' && !r.pickedUpAt;
    const target = pickupPhase ? r.fromFacility : r.toFacility;
    let etaAt: Date | null = null;
    let remainingKm: number | null = null;
    let arriving = false;
    if (hasCoords(target)) {
      remainingKm = haversineKm(latest, target);
      let minutes = travelMinutes(remainingKm, speedKmh);
      if (pickupPhase && hasCoords(r.fromFacility) && hasCoords(r.toFacility))
        minutes += HANDOVER_MINUTES + travelMinutes(haversineKm(r.fromFacility, r.toFacility));
      etaAt = addMinutes(latestAt, minutes);
      arriving = !pickupPhase && remainingKm <= ARRIVING_RADIUS_KM && !r.arrivingNotifiedAt;
      if (active)
        await this.prisma.referral.update({
          where: { id },
          data: { estimatedArrivalAt: etaAt, ...(arriving && { arrivingNotifiedAt: new Date() }) },
        });
    }
    if (r.vehicleId)
      await this.prisma.vehicle.update({
        where: { id: r.vehicleId },
        data: {
          lastLatitude: latest.latitude,
          lastLongitude: latest.longitude,
          lastSeenAt: latestAt,
        },
      });

    const rooms = new Set(
      [r.fromFacility.id, r.toFacility.id, r.vehicle?.facilityId].filter((x): x is string => !!x),
    );
    const payload = {
      referralId: id,
      code: r.code,
      phase: pickupPhase ? 'pickup' : 'transport',
      points: fresh
        .map((e) => ({
          clientId: e.clientId,
          latitude: e.latitude,
          longitude: e.longitude,
          recordedAt: e.recordedAt,
          speed: e.speed,
          accuracy: e.accuracy,
        }))
        .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)),
      etaAt,
      remainingKm: remainingKm == null ? null : Math.round(remainingKm * 10) / 10,
      speedKmh: speedKmh == null ? null : Math.round(speedKmh),
    };
    for (const f of rooms)
      await this.realtime.emitToFacility(f, RealtimeEvent.VehicleLocation, payload);
    if (arriving)
      for (const f of [r.toFacility.id, r.fromFacility.id])
        await this.realtime.emitToFacility(f, RealtimeEvent.VehicleArriving, {
          id,
          code: r.code,
          remainingKm: payload.remainingKm,
          etaAt,
        });
    return { accepted, created: fresh.length, etaAt };
  }
}
