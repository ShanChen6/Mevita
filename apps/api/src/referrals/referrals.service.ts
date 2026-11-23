import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { generateCode } from '../common/codes.js';
import { addMinutes } from '../common/vn-time.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeEvent } from '../realtime/realtime.events.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { toVitalDto, vitalSelect } from './referral-vitals.service.js';
import type { CreateReferralInput, ListReferralsQuery } from './referrals.schemas.js';

const ACTIVE = ['PENDING', 'ACCEPTED'] as const;

const facilityBrief = {
  id: true,
  name: true,
  type: true,
  phone: true,
  emergencyPhone: true,
  commune: { select: { fullName: true, province: { select: { code: true, fullName: true } } } },
} satisfies Prisma.HealthFacilitySelect;

const staffBrief = {
  id: true,
  fullName: true,
  phone: true,
  staffProfile: { select: { academicTitle: true, position: true } },
} satisfies Prisma.UserSelect;

const referralSelect = {
  id: true,
  code: true,
  priority: true,
  status: true,
  reason: true,
  clinicalSummary: true,
  initialTreatment: true,
  vehicleInfo: true,
  departedAt: true,
  estimatedArrivalAt: true,
  acceptedAt: true,
  preparationNote: true,
  rejectionReason: true,
  arrivedAt: true,
  cancelledAt: true,
  cancellationReason: true,
  createdAt: true,
  fromFacility: { select: facilityBrief },
  toFacility: { select: facilityBrief },
  referredBy: { select: staffBrief },
  escort: { select: staffBrief },
  acceptedBy: { select: staffBrief },
  patient: {
    select: {
      id: true,
      fullName: true,
      dateOfBirth: true,
      gender: true,
      bloodType: true,
      allergies: true,
      chronicConditions: true,
      nationalId: true,
      healthInsuranceNumber: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
    },
  },
  sourceRecord: {
    select: {
      id: true,
      code: true,
      status: true,
      encounterType: true,
      visitAt: true,
      chiefComplaint: true,
      symptoms: true,
      physicalExamination: true,
      pulse: true,
      temperature: true,
      systolicBp: true,
      diastolicBp: true,
      respiratoryRate: true,
      spo2: true,
      diagnosisNote: true,
      diagnoses: {
        select: { icdCode: true, isPrimary: true, icd10: { select: { nameVi: true } } },
        orderBy: [{ isPrimary: 'desc' }, { icdCode: 'asc' }],
      },
      prescriptionItems: {
        select: { drugName: true, strength: true, quantity: true, unit: true, instructions: true },
        orderBy: { sortOrder: 'asc' },
      },
      _count: { select: { clinicalImages: true } },
    },
  },
  _count: { select: { vitalLogs: true } },
  vitalLogs: { select: vitalSelect, orderBy: { recordedAt: 'desc' }, take: 1 },
} satisfies Prisma.ReferralSelect;

type ReferralRow = Prisma.ReferralGetPayload<{ select: typeof referralSelect }>;

const name = (
  u: { fullName: string; staffProfile: { academicTitle: string | null } | null } | null,
) =>
  u
    ? u.staffProfile?.academicTitle
      ? `${u.staffProfile.academicTitle}. ${u.fullName}`
      : u.fullName
    : null;

@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Bệnh viện tuyến trên nhận chuyển tuyến: trong tỉnh trước, sau đó liên tỉnh.
   * Kèm chuyên khoa và số bác sĩ đang trực trực tuyến (kênh realtime).
   */
  async destinations(user: AuthUser, q?: string) {
    const from = await this.facilityOf(user);
    const facilities = await this.prisma.healthFacility.findMany({
      where: {
        isActive: true,
        acceptsReferrals: true,
        id: { not: from.id },
        ...(q && { name: { contains: q, mode: 'insensitive' } }),
      },
      select: {
        ...facilityBrief,
        level: true,
        specialties: { select: { specialty: { select: { code: true, name: true } } } },
      },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });
    const provinceCode = from.commune.province.code;
    return facilities
      .map(({ specialties, ...f }) => ({
        ...f,
        specialties: specialties
          .map((s) => s.specialty)
          .sort((a, b) => a.name.localeCompare(b.name, 'vi')),
        sameProvince: f.commune.province.code === provinceCode,
        onDutyCount: this.realtime.presence.onDuty(f.id).length,
      }))
      .sort((a, b) => Number(b.sameProvince) - Number(a.sameProvince));
  }

  /** Nhân viên cơ sở mình — chọn người đi kèm xe. */
  async escorts(user: AuthUser) {
    const from = await this.facilityOf(user);
    const staff = await this.prisma.staffProfile.findMany({
      where: { facilityId: from.id, user: { isActive: true } },
      select: {
        userId: true,
        position: true,
        academicTitle: true,
        user: { select: { fullName: true } },
      },
      orderBy: { user: { fullName: 'asc' } },
    });
    return staff.map((s) => ({
      id: s.userId,
      fullName: s.user.fullName,
      academicTitle: s.academicTitle,
      position: s.position,
    }));
  }

  /**
   * Lệnh chuyển tuyến khẩn cấp: lưu phiếu, rồi phát `new_incoming_referral` tới phòng của bệnh viện đích.
   * Trả về số kết nối đã nhận cảnh báo — 0 nghĩa là chưa ai trực trực tuyến, cần gọi đường dây nóng.
   */
  async create(user: AuthUser, input: CreateReferralInput) {
    const from = await this.facilityOf(user);
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id: input.sourceRecordId },
      select: { id: true, facilityId: true, patientId: true },
    });
    if (!record || record.facilityId !== from.id)
      throw new NotFoundException('Không tìm thấy hồ sơ khám');
    if (input.toFacilityId === from.id)
      throw new BadRequestException('Không thể chuyển tuyến về chính cơ sở');

    const to = await this.prisma.healthFacility.findFirst({
      where: { id: input.toFacilityId, isActive: true, acceptsReferrals: true },
      select: { id: true },
    });
    if (!to) throw new BadRequestException('Bệnh viện không nhận chuyển tuyến');
    if (input.escortId) {
      const escort = await this.prisma.staffProfile.findFirst({
        where: { userId: input.escortId, facilityId: from.id, user: { isActive: true } },
      });
      if (!escort) throw new BadRequestException('Người đi kèm phải là nhân viên của cơ sở');
    }
    const open = await this.prisma.referral.findFirst({
      where: { sourceRecordId: record.id, status: { in: [...ACTIVE] } },
      select: { code: true },
    });
    if (open)
      throw new ConflictException(`Hồ sơ này đã có phiếu chuyển tuyến ${open.code} đang thực hiện`);

    const now = new Date();
    let referral: ReferralRow | null = null;
    for (let attempt = 0; attempt < 3 && !referral; attempt++) {
      try {
        referral = await this.prisma.referral.create({
          data: {
            code: generateCode('CT'),
            patientId: record.patientId,
            sourceRecordId: record.id,
            fromFacilityId: from.id,
            toFacilityId: to.id,
            referredById: user.id,
            priority: input.priority,
            reason: input.reason,
            clinicalSummary: input.clinicalSummary,
            initialTreatment: input.initialTreatment,
            escortId: input.escortId,
            vehicleInfo: input.vehicleInfo,
            departedAt: now,
            estimatedArrivalAt: addMinutes(now, input.etaMinutes),
          },
          select: referralSelect,
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'))
          throw error;
      }
    }
    if (!referral) throw new ConflictException('Không tạo được mã phiếu, vui lòng thử lại');

    const delivered = await this.realtime.emitToFacility(
      to.id,
      RealtimeEvent.NewIncomingReferral,
      this.alertPayload(referral),
    );
    await this.audit.log({
      userId: user.id,
      action: 'CREATE',
      entityType: 'Referral',
      entityId: referral.id,
      metadata: { to: to.id, priority: input.priority, delivered },
    });
    return { referral: this.toDto(referral), delivered };
  }

  async list(user: AuthUser, { direction, status, active }: ListReferralsQuery) {
    const facility = await this.facilityOf(user);
    const rows = await this.prisma.referral.findMany({
      where: {
        ...(direction === 'incoming'
          ? { toFacilityId: facility.id }
          : { fromFacilityId: facility.id }),
        ...(status && { status }),
        ...(active && { status: { in: [...ACTIVE] } }),
      },
      select: referralSelect,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    // Ca đang hoạt động: mức độ khẩn trước, rồi xe tới sớm trước
    const rank = { CRITICAL: 0, URGENT: 1, ROUTINE: 2 } as const;
    if (active) {
      rows.sort(
        (a, b) =>
          rank[a.priority] - rank[b.priority] ||
          (a.estimatedArrivalAt?.getTime() ?? 0) - (b.estimatedArrivalAt?.getTime() ?? 0),
      );
    }
    return rows.map((r) => this.toDto(r));
  }

  /** Chi tiết phiếu: chỉ nhân viên cơ sở gửi hoặc cơ sở nhận (và quản trị). */
  async get(id: string, user: AuthUser) {
    const referral = await this.prisma.referral.findUnique({
      where: { id },
      select: referralSelect,
    });
    const allowed =
      referral &&
      (user.role === 'ADMIN' ||
        (!!user.facilityId &&
          [referral.fromFacility.id, referral.toFacility.id].includes(user.facilityId)));
    if (!referral || !allowed) throw new NotFoundException('Không tìm thấy phiếu chuyển tuyến');
    await this.audit.log({ userId: user.id, action: 'VIEW', entityType: 'Referral', entityId: id });
    return this.toDto(referral);
  }

  /** Cơ sở gửi huỷ lệnh (VD bệnh nhân ổn định, đổi nơi chuyển) — báo ngay cho bệnh viện đích. */
  async cancel(id: string, user: AuthUser, reason: string) {
    const referral = await this.prisma.referral.findUnique({
      where: { id },
      select: { fromFacilityId: true, toFacilityId: true, code: true },
    });
    if (!referral || referral.fromFacilityId !== user.facilityId)
      throw new NotFoundException('Không tìm thấy phiếu chuyển tuyến');
    const { count } = await this.prisma.referral.updateMany({
      where: { id, status: { in: [...ACTIVE] } },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason },
    });
    if (count === 0) throw new ConflictException('Phiếu không còn ở trạng thái có thể huỷ');
    const updated = await this.prisma.referral.findUniqueOrThrow({
      where: { id },
      select: referralSelect,
    });
    await this.realtime.emitToFacility(referral.toFacilityId, RealtimeEvent.ReferralUpdated, {
      id,
      code: referral.code,
      status: 'CANCELLED',
      cancellationReason: reason,
    });
    await this.audit.log({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Referral',
      entityId: id,
      metadata: { action: 'cancel' },
    });
    return this.toDto(updated);
  }

  private async facilityOf(user: AuthUser) {
    if (!user.facilityId) throw new BadRequestException('Tài khoản chưa gắn cơ sở công tác');
    return this.prisma.healthFacility.findUniqueOrThrow({
      where: { id: user.facilityId },
      select: facilityBrief,
    });
  }

  /** Nội dung cảnh báo realtime — đủ để bác sĩ trực nắm tình huống ngay, chi tiết xem qua API. */
  private alertPayload(r: ReferralRow) {
    const primary =
      r.sourceRecord.diagnoses.find((d) => d.isPrimary) ?? r.sourceRecord.diagnoses[0];
    return {
      id: r.id,
      code: r.code,
      priority: r.priority,
      createdAt: r.createdAt,
      estimatedArrivalAt: r.estimatedArrivalAt,
      reason: r.reason,
      patient: {
        fullName: r.patient.fullName,
        dateOfBirth: r.patient.dateOfBirth,
        gender: r.patient.gender,
        allergies: r.patient.allergies,
        bloodType: r.patient.bloodType,
      },
      diagnosis: primary ? { icdCode: primary.icdCode, name: primary.icd10.nameVi } : null,
      fromFacility: {
        name: r.fromFacility.name,
        province: r.fromFacility.commune.province.fullName,
      },
      referredBy: name(r.referredBy),
    };
  }

  private toDto(r: ReferralRow) {
    const { referredBy, escort, acceptedBy, sourceRecord, _count, vitalLogs, ...rest } = r;
    return {
      ...rest,
      referredBy: { id: referredBy.id, name: name(referredBy), phone: referredBy.phone },
      escort: escort && { id: escort.id, name: name(escort), phone: escort.phone },
      acceptedBy: acceptedBy && { id: acceptedBy.id, name: name(acceptedBy) },
      interProvincial: r.fromFacility.commune.province.code !== r.toFacility.commune.province.code,
      vitalLogCount: _count.vitalLogs,
      latestVital: vitalLogs[0] ? toVitalDto(vitalLogs[0]) : null,
      sourceRecord: {
        ...sourceRecord,
        imageCount: sourceRecord._count.clinicalImages,
        _count: undefined,
        diagnoses: sourceRecord.diagnoses.map((d) => ({
          icdCode: d.icdCode,
          name: d.icd10.nameVi,
          isPrimary: d.isPrimary,
        })),
      },
    };
  }
}
