import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toVitalDto, vitalSelect } from './vital-dto.js';

/** Giới hạn số chặng khi lần theo chuỗi (phòng dữ liệu vòng lặp) */
const MAX_HOPS = 10;

const facility = {
  select: {
    id: true,
    name: true,
    type: true,
    commune: { select: { province: { select: { name: true } } } },
  },
} as const;

const hopSelect = {
  id: true,
  code: true,
  status: true,
  priority: true,
  reason: true,
  createdAt: true,
  departedAt: true,
  acceptedAt: true,
  arrivedAt: true,
  cancelledAt: true,
  estimatedArrivalAt: true,
  acceptanceType: true,
  forwardNote: true,
  rejectionReason: true,
  redirectFacility: { select: { id: true, name: true } },
  transportMode: true,
  vehicleInfo: true,
  vehicle: { select: { plateNumber: true, facility: { select: { id: true, name: true } } } },
  fromFacility: facility,
  toFacility: facility,
  sourceRecord: {
    select: {
      id: true,
      code: true,
      visitAt: true,
      chiefComplaint: true,
      sourceReferralId: true,
      diagnoses: {
        where: { isPrimary: true },
        select: { icdCode: true, icd10: { select: { nameVi: true } } },
        take: 1,
      },
    },
  },
  continuationRecord: { select: { id: true, code: true, status: true, visitAt: true } },
  vitalLogs: { select: vitalSelect, orderBy: { recordedAt: 'asc' } },
} satisfies Prisma.ReferralSelect;

type Hop = Prisma.ReferralGetPayload<{ select: typeof hopSelect }>;

/** Ưu tiên chặng "đang có hiệu lực" khi một hồ sơ có nhiều lệnh (VD bị đề nghị chuyển rồi gửi lại) */
const RANK = { ARRIVED: 0, ACCEPTED: 1, PENDING: 2, REJECTED: 3, CANCELLED: 4 } as const;

/**
 * Hành trình chuyển tuyến nhiều chặng (Task A): Xã → Tỉnh → Trung ương…
 * Chặng trước: phiếu khám nguồn là hồ sơ tiếp nối của phiếu nào. Chặng sau: lệnh lập từ hồ sơ tiếp nối.
 */
@Injectable()
export class JourneyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Các phiếu trong chuỗi, theo thứ tự thời gian. */
  async chain(referralId: string): Promise<Hop[]> {
    const start = await this.prisma.referral.findUnique({
      where: { id: referralId },
      select: hopSelect,
    });
    if (!start) return [];
    const hops: Hop[] = [start];
    const seen = new Set([start.id]);
    // Lùi về chặng trước
    let back = start.sourceRecord.sourceReferralId;
    while (back && hops.length < MAX_HOPS && !seen.has(back)) {
      const prev = await this.prisma.referral.findUnique({
        where: { id: back },
        select: hopSelect,
      });
      if (!prev) break;
      seen.add(prev.id);
      hops.unshift(prev);
      back = prev.sourceRecord.sourceReferralId;
    }
    // Tiến tới chặng sau
    let cur = start;
    while (cur.continuationRecord && hops.length < MAX_HOPS) {
      const nexts = await this.prisma.referral.findMany({
        where: { sourceRecordId: cur.continuationRecord.id, id: { notIn: [...seen] } },
        select: hopSelect,
        orderBy: { createdAt: 'desc' },
      });
      const next = nexts.sort((a, b) => RANK[a.status] - RANK[b.status])[0];
      if (!next) break;
      seen.add(next.id);
      hops.push(next);
      cur = next;
    }
    return hops;
  }

  /** Cơ sở tham gia bất kỳ chặng nào (gửi, nhận, cử xe) được xem cả chuỗi — điều trị liên tục. */
  static facilities(hops: Hop[]) {
    return new Set(
      hops
        .flatMap((h) => [h.fromFacility.id, h.toFacility.id, h.vehicle?.facility.id])
        .filter((x): x is string => !!x),
    );
  }

  async canView(user: Pick<AuthUser, 'role' | 'facilityId'>, referralId: string) {
    if (user.role === 'ADMIN') return true;
    if (!user.facilityId) return false;
    return JourneyService.facilities(await this.chain(referralId)).has(user.facilityId);
  }

  async journey(referralId: string, user: AuthUser) {
    const hops = await this.chain(referralId);
    const allowed =
      hops.length > 0 &&
      (user.role === 'ADMIN' ||
        (!!user.facilityId && JourneyService.facilities(hops).has(user.facilityId)));
    if (!allowed) throw new NotFoundException('Không tìm thấy phiếu chuyển tuyến');
    const first = hops[0];
    const last = hops.at(-1)!;
    const dx = first.sourceRecord.diagnoses[0];
    return {
      /** Lần khám đầu tiên (nơi bắt đầu hành trình) */
      origin: {
        facility: {
          id: first.fromFacility.id,
          name: first.fromFacility.name,
          province: first.fromFacility.commune.province.name,
        },
        recordId: first.sourceRecord.id,
        recordCode: first.sourceRecord.code,
        visitAt: first.sourceRecord.visitAt,
        chiefComplaint: first.sourceRecord.chiefComplaint,
        diagnosis: dx ? { icdCode: dx.icdCode, name: dx.icd10.nameVi } : null,
      },
      current: referralId,
      /** Đã tới nơi điều trị cuối cùng (chặng cuối ARRIVED) */
      completed: last.status === 'ARRIVED',
      totalMinutes:
        last.arrivedAt != null
          ? Math.round((last.arrivedAt.getTime() - first.createdAt.getTime()) / 60_000)
          : null,
      hops: hops.map((h, i) => ({
        index: i + 1,
        id: h.id,
        code: h.code,
        status: h.status,
        priority: h.priority,
        reason: h.reason,
        createdAt: h.createdAt,
        departedAt: h.departedAt,
        acceptedAt: h.acceptedAt,
        arrivedAt: h.arrivedAt,
        cancelledAt: h.cancelledAt,
        estimatedArrivalAt: h.estimatedArrivalAt,
        acceptanceType: h.acceptanceType,
        forwardNote: h.forwardNote,
        rejectionReason: h.rejectionReason,
        redirectFacility: h.redirectFacility,
        transportMode: h.transportMode,
        vehicle: h.vehicle?.plateNumber ?? h.vehicleInfo ?? null,
        from: {
          id: h.fromFacility.id,
          name: h.fromFacility.name,
          type: h.fromFacility.type,
          province: h.fromFacility.commune.province.name,
        },
        to: {
          id: h.toFacility.id,
          name: h.toFacility.name,
          type: h.toFacility.type,
          province: h.toFacility.commune.province.name,
        },
        interProvincial:
          h.fromFacility.commune.province.name !== h.toFacility.commune.province.name,
        sourceRecord: {
          id: h.sourceRecord.id,
          code: h.sourceRecord.code,
          visitAt: h.sourceRecord.visitAt,
        },
        continuationRecord: h.continuationRecord,
        vitals: h.vitalLogs.map(toVitalDto),
      })),
    };
  }
}
