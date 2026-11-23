import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeEvent } from '../realtime/realtime.events.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import type { VitalEntryInput } from './referrals.schemas.js';

/** Người ghi phải thuộc cơ sở gửi (hoặc là người đi kèm); người xem: cơ sở gửi hoặc nhận. */
type Actor = Pick<AuthUser, 'id' | 'role' | 'facilityId'>;

/** Thiết bị được phép lệch giờ tối đa so với máy chủ. */
const CLOCK_SKEW_MS = 5 * 60_000;
/** Ca đã kết thúc vẫn nhận dữ liệu đo trên đường được đồng bộ muộn (xe vừa ra khỏi vùng mất sóng). */
const LATE_SYNC_MS = 6 * 3600_000;

export const vitalSelect = {
  id: true,
  clientId: true,
  recordedAt: true,
  receivedAt: true,
  pulse: true,
  systolicBp: true,
  diastolicBp: true,
  spo2: true,
  respiratoryRate: true,
  temperature: true,
  consciousness: true,
  gcs: true,
  note: true,
  recordedBy: { select: { fullName: true, staffProfile: { select: { academicTitle: true } } } },
} satisfies Prisma.ReferralVitalLogSelect;

type VitalRow = Prisma.ReferralVitalLogGetPayload<{ select: typeof vitalSelect }>;

export function toVitalDto({ recordedBy, ...v }: VitalRow) {
  return {
    ...v,
    recordedBy: recordedBy.staffProfile?.academicTitle
      ? `${recordedBy.staffProfile.academicTitle}. ${recordedBy.fullName}`
      : recordedBy.fullName,
  };
}

/**
 * Diễn biến sinh tồn trên xe chuyển viện (Task 4.3).
 * Ghi theo lô và idempotent theo `clientId`: thiết bị mất sóng lưu tạm rồi gửi lại cả lô khi có mạng.
 */
@Injectable()
export class ReferralVitalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async list(referralId: string, user: Actor) {
    const r = await this.prisma.referral.findUnique({
      where: { id: referralId },
      select: { fromFacilityId: true, toFacilityId: true },
    });
    const allowed =
      r &&
      (user.role === 'ADMIN' ||
        (!!user.facilityId && [r.fromFacilityId, r.toFacilityId].includes(user.facilityId)));
    if (!r || !allowed) throw new NotFoundException('Không tìm thấy phiếu chuyển tuyến');
    const rows = await this.prisma.referralVitalLog.findMany({
      where: { referralId },
      select: vitalSelect,
      orderBy: { recordedAt: 'asc' },
    });
    return rows.map(toVitalDto);
  }

  /**
   * Ghi một lô chỉ số. Trả `accepted` = mọi clientId đã nằm trong CSDL (kể cả bản gửi trùng) để thiết bị
   * xoá khỏi hàng đợi; chỉ bản mới được phát `vital_update` tới bệnh viện nhận và cơ sở gửi.
   */
  async record(referralId: string, user: Actor, entries: VitalEntryInput[]) {
    const r = await this.prisma.referral.findUnique({
      where: { id: referralId },
      select: {
        id: true,
        code: true,
        status: true,
        createdAt: true,
        arrivedAt: true,
        cancelledAt: true,
        fromFacilityId: true,
        toFacilityId: true,
        escortId: true,
      },
    });
    if (!r) throw new NotFoundException('Không tìm thấy phiếu chuyển tuyến');
    if (r.fromFacilityId !== user.facilityId && r.escortId !== user.id)
      throw new ForbiddenException('Chỉ nhân viên cơ sở chuyển đi mới cập nhật được sinh tồn');

    const now = Date.now();
    const endedAt = r.arrivedAt ?? r.cancelledAt;
    const open =
      r.status === 'PENDING' ||
      r.status === 'ACCEPTED' ||
      (r.status === 'ARRIVED' && !!endedAt && now - endedAt.getTime() < LATE_SYNC_MS);
    if (!open)
      throw new ConflictException('Phiếu chuyển tuyến đã kết thúc, không nhận thêm chỉ số');

    for (const e of entries) {
      const t = new Date(e.recordedAt).getTime();
      if (t > now + CLOCK_SKEW_MS || t < r.createdAt.getTime() - CLOCK_SKEW_MS)
        throw new ConflictException('Thời điểm đo không hợp lệ — kiểm tra đồng hồ thiết bị');
    }

    const clientIds = entries.map((e) => e.clientId);
    const existing = await this.prisma.referralVitalLog.findMany({
      where: { clientId: { in: clientIds } },
      select: { clientId: true, referralId: true },
    });
    if (existing.some((x) => x.referralId !== referralId))
      throw new ConflictException('Mã bản ghi trùng với phiếu khác');
    const seen = new Set(existing.map((x) => x.clientId));
    const fresh = entries.filter((e) => !seen.has(e.clientId) && !!seen.add(e.clientId));

    if (fresh.length > 0) {
      await this.prisma.referralVitalLog.createMany({
        data: fresh.map((e) => ({
          ...e,
          referralId,
          recordedAt: new Date(e.recordedAt),
          recordedById: user.id,
        })),
        skipDuplicates: true,
      });
      const created = await this.prisma.referralVitalLog.findMany({
        where: { clientId: { in: fresh.map((e) => e.clientId) } },
        select: vitalSelect,
        orderBy: { recordedAt: 'asc' },
      });
      const payload = { referralId, code: r.code, vitals: created.map(toVitalDto) };
      await this.realtime.emitToFacility(r.toFacilityId, RealtimeEvent.VitalUpdate, payload);
      await this.realtime.emitToFacility(r.fromFacilityId, RealtimeEvent.VitalUpdate, payload);
    }
    return { accepted: clientIds, created: fresh.length };
  }
}
