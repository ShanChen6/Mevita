import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { ClinicalImagesService } from '../clinical-images/clinical-images.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { generateCode } from '../common/codes.js';
import { addMinutes } from '../common/vn-time.js';
import { Prisma } from '../generated/prisma/client.js';
import type { VehicleType } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeEvent } from '../realtime/realtime.events.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { toVitalDto, vitalSelect } from './referral-vitals.service.js';
import { belowRecommendation } from './transport.js';
import type { CreateReferralInput, ListReferralsQuery } from './referrals.schemas.js';

const ACTIVE = ['PENDING', 'ACCEPTED'] as const;

const facilityBrief = {
  id: true,
  name: true,
  type: true,
  phone: true,
  emergencyPhone: true,
  latitude: true,
  longitude: true,
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
  receivedBy: { select: staffBrief },
  continuationRecord: { select: { id: true, code: true, status: true, signedAt: true } },
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
  transportMode: true,
  transportNote: true,
  pickupRequestedAt: true,
  pickupAssignedAt: true,
  pickedUpAt: true,
  arrivingNotifiedAt: true,
  vehicle: {
    select: {
      id: true,
      plateNumber: true,
      type: true,
      equipment: true,
      driverName: true,
      driverPhone: true,
      facility: { select: { id: true, name: true, phone: true, emergencyPhone: true } },
    },
  },
  locations: {
    select: { latitude: true, longitude: true, recordedAt: true, speed: true, accuracy: true },
    orderBy: { recordedAt: 'desc' },
    take: 1,
  },
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

/** Dòng tóm tắt diễn biến trên xe đưa vào bệnh sử của hồ sơ tiếp nối. */
function vitalsLine(n: number, last?: Date) {
  if (n === 0) return null;
  const t = last?.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
  return `Diễn biến trên xe: ${n} lần đo sinh tồn${t ? `, lần cuối lúc ${t}` : ''} (xem phiếu chuyển tuyến).`;
}

export type ReferralRowFull = ReferralRow;
export { referralSelect };

@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly audit: AuditService,
    private readonly images: ClinicalImagesService,
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
    // Phương tiện (Task C): kiểm tra theo khuyến nghị của mức độ ưu tiên
    const mode = input.transportMode ?? null;
    let vehicle: { id: string; type: VehicleType } | null = null;
    if (mode === 'FACILITY_VEHICLE') {
      if (!input.vehicleId) throw new BadRequestException('Chọn xe của cơ sở');
      const v = await this.prisma.vehicle.findFirst({
        where: { id: input.vehicleId, facilityId: from.id, isActive: true },
        select: { id: true, type: true, status: true },
      });
      if (!v) throw new BadRequestException('Xe không thuộc cơ sở');
      if (v.status !== 'AVAILABLE')
        throw new ConflictException('Xe đang làm nhiệm vụ hoặc bảo trì, chọn xe khác');
      vehicle = v;
    } else if (input.vehicleId) {
      throw new BadRequestException('Chỉ chọn xe khi dùng xe của cơ sở');
    }
    if (
      mode &&
      belowRecommendation(input.priority, mode, vehicle?.type ?? null) &&
      (input.transportNote?.length ?? 0) < 10
    )
      throw new BadRequestException(
        'Phương tiện thấp hơn khuyến nghị cho mức độ này — ghi rõ lý do (ít nhất 10 ký tự)',
      );
    const pickup = mode === 'PICKUP';
    if (!pickup && input.etaMinutes == null)
      throw new BadRequestException('Nhập thời gian dự kiến xe tới');

    const open = await this.prisma.referral.findFirst({
      where: { sourceRecordId: record.id, status: { in: [...ACTIVE] } },
      select: { code: true },
    });
    if (open)
      throw new ConflictException(`Hồ sơ này đã có phiếu chuyển tuyến ${open.code} đang thực hiện`);

    const now = new Date();
    // Giữ xe trước (có điều kiện) — hai ca không thể cùng lấy một xe
    if (vehicle) {
      const { count } = await this.prisma.vehicle.updateMany({
        where: { id: vehicle.id, status: 'AVAILABLE' },
        data: { status: 'ON_MISSION' },
      });
      if (count === 0) throw new ConflictException('Xe vừa được giao cho ca khác, chọn xe khác');
    }
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
            transportMode: mode,
            vehicleId: vehicle?.id ?? null,
            transportNote: input.transportNote,
            // Xe đón: bệnh nhân chưa rời trạm, giờ tới tính khi có xe nhận
            pickupRequestedAt: pickup ? now : null,
            departedAt: pickup ? null : now,
            estimatedArrivalAt:
              pickup || input.etaMinutes == null ? null : addMinutes(now, input.etaMinutes),
          },
          select: referralSelect,
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
          if (vehicle) await this.releaseVehicle(vehicle.id);
          throw error;
        }
      }
    }
    if (!referral) {
      if (vehicle) await this.releaseVehicle(vehicle.id);
      throw new ConflictException('Không tạo được mã phiếu, vui lòng thử lại');
    }

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
      metadata: {
        to: to.id,
        priority: input.priority,
        delivered,
        transportMode: mode,
        ...(mode &&
          belowRecommendation(input.priority, mode, vehicle?.type ?? null) && {
            belowRecommendation: true,
          }),
      },
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
          [
            referral.fromFacility.id,
            referral.toFacility.id,
            referral.vehicle?.facility.id,
          ].includes(user.facilityId)));
    if (!referral || !allowed) throw new NotFoundException('Không tìm thấy phiếu chuyển tuyến');
    await this.audit.log({ userId: user.id, action: 'VIEW', entityType: 'Referral', entityId: id });
    const images = await this.prisma.clinicalImage.findMany({
      where: { medicalRecordId: referral.sourceRecord.id },
      select: {
        id: true,
        type: true,
        cloudinaryPublicId: true,
        description: true,
        takenAt: true,
        width: true,
        height: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return { ...this.toDto(referral), sourceImages: images.map((img) => this.images.toDto(img)) };
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
    await this.releaseVehicle(updated.vehicle?.id);
    await this.notifyChange(updated, user, 'cancel');
    await this.audit.log({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Referral',
      entityId: id,
      metadata: { action: 'cancel' },
    });
    return this.toDto(updated);
  }

  /**
   * Bệnh viện nhận xác nhận "Tiếp nhận & sẵn sàng ê-kíp" — tuyến dưới và người đi kèm nhận phản hồi ngay.
   * Chỉ một bác sĩ xác nhận được (cập nhật có điều kiện PENDING → ACCEPTED).
   */
  async accept(id: string, user: AuthUser, preparationNote: string | null) {
    await this.assertReceiver(id, user);
    const { count } = await this.prisma.referral.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'ACCEPTED', acceptedAt: new Date(), acceptedById: user.id, preparationNote },
    });
    if (count === 0) throw new ConflictException('Ca này đã được xử lý bởi người khác');
    return this.afterResponse(id, user, 'accept');
  }

  /** Cập nhật ghi chú chuẩn bị sau khi đã tiếp nhận (VD đổi phòng mổ). */
  async updatePreparation(id: string, user: AuthUser, preparationNote: string) {
    await this.assertReceiver(id, user);
    const { count } = await this.prisma.referral.updateMany({
      where: { id, status: 'ACCEPTED' },
      data: { preparationNote },
    });
    if (count === 0)
      throw new ConflictException('Chỉ cập nhật được ca đã tiếp nhận, còn đang trên đường');
    return this.afterResponse(id, user, 'preparation');
  }

  /** Không thể tiếp nhận (hết giường, thiếu chuyên khoa…) — tuyến dưới chuyển nơi khác. */
  async reject(id: string, user: AuthUser, reason: string) {
    await this.assertReceiver(id, user);
    const { count } = await this.prisma.referral.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
        acceptedById: user.id,
        acceptedAt: new Date(),
      },
    });
    if (count === 0) throw new ConflictException('Ca này đã được xử lý bởi người khác');
    return this.afterResponse(id, user, 'reject');
  }

  /**
   * Xe tới nơi (Task 5.1): phiếu → ARRIVED và mở **hồ sơ điều trị tiếp nối** tại bệnh viện nhận, kế thừa
   * bệnh sử, tóm tắt chuyển tuyến, xử trí tuyến dưới, sinh tồn mới nhất trên xe và chẩn đoán làm việc —
   * bác sĩ không phải hỏi lại từ đầu. Gọi lại khi đã tiếp nhận trả về hồ sơ đã mở (bấm hai lần không tạo trùng).
   */
  async arrive(id: string, user: AuthUser) {
    await this.assertReceiver(id, user);
    const r = await this.prisma.referral.findUniqueOrThrow({
      where: { id },
      select: {
        ...referralSelect,
        sourceRecord: {
          select: {
            ...referralSelect.sourceRecord.select,
            weightKg: true,
            heightCm: true,
          },
        },
      },
    });
    if (r.status === 'ARRIVED' && r.continuationRecord)
      return { referral: this.toDto(r), recordId: r.continuationRecord.id, created: false };
    if (r.status !== 'PENDING' && r.status !== 'ACCEPTED')
      throw new ConflictException('Phiếu chuyển tuyến đã kết thúc, không thể tiếp nhận');

    const src = r.sourceRecord;
    const v = r.vitalLogs[0];
    const now = new Date();
    const symptoms = [
      src.symptoms && `Bệnh sử tại tuyến dưới: ${src.symptoms}`,
      src.physicalExamination && `Khám tại tuyến dưới: ${src.physicalExamination}`,
      `Tóm tắt chuyển tuyến (${r.code} — ${r.fromFacility.name}): ${r.clinicalSummary}`,
      r.initialTreatment && `Xử trí tuyến dưới: ${r.initialTreatment}`,
      vitalsLine(r._count.vitalLogs, v?.recordedAt),
    ]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 5000);

    const recordId = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.referral.updateMany({
        where: { id, status: r.status },
        data: {
          status: 'ARRIVED',
          arrivedAt: now,
          receivedById: user.id,
          // Xe tới trước khi kịp bấm xác nhận: ghi nhận luôn người tiếp nhận
          ...(r.status === 'PENDING' && { acceptedAt: now, acceptedById: user.id }),
        },
      });
      if (count === 0)
        throw new ConflictException('Ca này vừa được người khác cập nhật, hãy tải lại');
      const record = await tx.medicalRecord.create({
        data: {
          code: generateCode('BA'),
          patientId: r.patient.id,
          facilityId: r.toFacility.id,
          doctorId: user.id,
          sourceReferralId: id,
          encounterType: 'EMERGENCY',
          visitAt: now,
          chiefComplaint: `Chuyển tuyến từ ${r.fromFacility.name}: ${src.chiefComplaint}`.slice(
            0,
            500,
          ),
          symptoms,
          // Sinh tồn khởi điểm: lần đo mới nhất trên xe (chỉ số xe không đo để trống — không trộn với
          // số đo cũ); xe chưa đo lần nào thì lấy sinh tồn lúc khám tại tuyến dưới
          ...(v
            ? {
                pulse: v.pulse,
                systolicBp: v.systolicBp,
                diastolicBp: v.diastolicBp,
                spo2: v.spo2,
                respiratoryRate: v.respiratoryRate,
                temperature: v.temperature,
              }
            : {
                pulse: src.pulse,
                systolicBp: src.systolicBp,
                diastolicBp: src.diastolicBp,
                spo2: src.spo2,
                respiratoryRate: src.respiratoryRate,
                temperature: src.temperature,
              }),
          weightKg: src.weightKg,
          heightCm: src.heightCm,
          // Chẩn đoán làm việc kế thừa từ tuyến dưới — bác sĩ tuyến trên xác định lại trước khi ký
          diagnoses: {
            create: src.diagnoses.map((d) => ({
              icdCode: d.icdCode,
              isPrimary: d.isPrimary,
              note: 'Chẩn đoán tuyến dưới',
            })),
          },
        },
        select: { id: true },
      });
      return record.id;
    });

    const updated = await this.prisma.referral.findUniqueOrThrow({
      where: { id },
      select: referralSelect,
    });
    await this.releaseVehicle(updated.vehicle?.id);
    await this.notifyChange(updated, user, 'arrive');
    await this.audit.log({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Referral',
      entityId: id,
      metadata: { action: 'arrive', recordId },
    });
    return { referral: this.toDto(updated), recordId, created: true };
  }

  /** Trả xe về trạng thái sẵn sàng khi ca kết thúc. */
  async releaseVehicle(vehicleId: string | null | undefined) {
    if (!vehicleId) return;
    await this.prisma.vehicle.updateMany({
      where: { id: vehicleId, status: 'ON_MISSION' },
      data: { status: 'AVAILABLE' },
    });
  }

  private async assertReceiver(id: string, user: AuthUser) {
    const r = await this.prisma.referral.findUnique({
      where: { id },
      select: { toFacilityId: true },
    });
    if (!r || (r.toFacilityId !== user.facilityId && user.role !== 'ADMIN'))
      throw new NotFoundException('Không tìm thấy phiếu chuyển tuyến');
  }

  private async afterResponse(
    id: string,
    user: AuthUser,
    action: 'accept' | 'preparation' | 'reject',
  ) {
    const updated = await this.prisma.referral.findUniqueOrThrow({
      where: { id },
      select: referralSelect,
    });
    if (action === 'reject') await this.releaseVehicle(updated.vehicle?.id);
    await this.notifyChange(updated, user, action);
    await this.audit.log({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Referral',
      entityId: id,
      metadata: { action },
    });
    return this.toDto(updated);
  }

  /**
   * Phát `referral_updated` tới cả hai phía: `side = outgoing` cho cơ sở gửi (bác sĩ chuyển, người đi kèm),
   * `side = incoming` cho bệnh viện nhận (các bác sĩ trực khác thấy ca đã có người xử lý).
   */
  async notifyChange(
    r: ReferralRow,
    actor: AuthUser,
    action: 'accept' | 'preparation' | 'reject' | 'cancel' | 'arrive' | 'dispatch' | 'picked_up',
  ) {
    const actorRow = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: staffBrief,
    });
    const base = {
      id: r.id,
      code: r.code,
      action,
      status: r.status,
      priority: r.priority,
      sourceRecordId: r.sourceRecord.id,
      patientName: r.patient.fullName,
      fromFacility: r.fromFacility.name,
      toFacility: r.toFacility.name,
      toFacilityPhone: r.toFacility.emergencyPhone ?? r.toFacility.phone,
      preparationNote: r.preparationNote,
      rejectionReason: r.rejectionReason,
      cancellationReason: r.cancellationReason,
      by: name(actorRow),
      byUserId: actor.id,
      transportMode: r.transportMode,
      vehicle: r.vehicle && {
        plateNumber: r.vehicle.plateNumber,
        type: r.vehicle.type,
        facility: r.vehicle.facility.name,
      },
      estimatedArrivalAt: r.estimatedArrivalAt,
      at: new Date(),
    };
    await Promise.all([
      this.realtime.emitToFacility(r.fromFacility.id, RealtimeEvent.ReferralUpdated, {
        ...base,
        side: 'outgoing',
      }),
      this.realtime.emitToFacility(r.toFacility.id, RealtimeEvent.ReferralUpdated, {
        ...base,
        side: 'incoming',
      }),
    ]);
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

  toDto(r: ReferralRow) {
    const {
      referredBy,
      escort,
      acceptedBy,
      receivedBy,
      sourceRecord,
      _count,
      vitalLogs,
      locations,
      ...rest
    } = r;
    return {
      ...rest,
      referredBy: { id: referredBy.id, name: name(referredBy), phone: referredBy.phone },
      escort: escort && { id: escort.id, name: name(escort), phone: escort.phone },
      acceptedBy: acceptedBy && { id: acceptedBy.id, name: name(acceptedBy) },
      receivedBy: receivedBy && { id: receivedBy.id, name: name(receivedBy) },
      interProvincial: r.fromFacility.commune.province.code !== r.toFacility.commune.province.code,
      vitalLogCount: _count.vitalLogs,
      latestVital: vitalLogs[0] ? toVitalDto(vitalLogs[0]) : null,
      latestLocation: locations[0] ?? null,
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
