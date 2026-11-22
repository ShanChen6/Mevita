import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { addMinutes, vnDateOf, vnStartOfDay } from '../common/vn-time.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { classifyLookup, type LookupKind } from './lookup-query.js';
import type { CreatePatientInput } from './patients.schemas.js';

const RECENT_VISITS = 5;

const summarySelect = {
  id: true,
  fullName: true,
  dateOfBirth: true,
  gender: true,
  nationalId: true,
  healthInsuranceNumber: true,
  healthInsuranceExpiry: true,
  phone: true,
  bloodType: true,
  allergies: true,
  chronicConditions: true,
  addressDetail: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
  userId: true,
  commune: {
    select: { code: true, fullName: true, province: { select: { code: true, fullName: true } } },
  },
} satisfies Prisma.PatientSelect;

/** Bệnh nhân có liên hệ với cơ sở (cùng điều kiện với AccessPolicyService). */
const linkedTo = (facilityId: string): Prisma.PatientWhereInput => ({
  OR: [
    { appointments: { some: { facilityId } } },
    { medicalRecords: { some: { facilityId } } },
    {
      referrals: {
        some: {
          status: { not: 'CANCELLED' },
          OR: [{ toFacilityId: facilityId }, { fromFacilityId: facilityId }],
        },
      },
    },
  ],
});

@Injectable()
export class PatientLookupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Tra cứu nhanh tại quầy tiếp đón / phòng khám.
   *
   * Mã định danh đầy đủ (CCCD, BHYT, SĐT, mã lịch hẹn) tìm trên toàn hệ thống: bệnh nhân đang có mặt
   * và xuất trình giấy tờ, bác sĩ cần thấy tiền sử để khám an toàn. Tìm theo tên chỉ trong các bệnh nhân
   * đã có liên hệ với cơ sở — không duyệt được danh sách bệnh nhân toàn quốc. Mọi lần tra cứu đều ghi audit.
   */
  async lookup(user: AuthUser, q: string, now = new Date()) {
    const facilityId = this.requireFacility(user);
    const { kind, value } = classifyLookup(q);
    if (kind === 'NAME' && value.length < 2) throw new BadRequestException('Nhập ít nhất 2 ký tự');

    const where = this.whereFor(kind, value, facilityId);
    const ids = (
      await this.prisma.patient.findMany({
        where,
        select: { id: true },
        take: kind === 'NAME' ? 20 : 5,
        orderBy: { fullName: 'asc' },
      })
    ).map((p) => p.id);

    await this.audit.log({
      userId: user.id,
      action: 'LOOKUP',
      entityType: 'Patient',
      metadata: { kind, matched: ids.length, patientIds: ids },
    });

    const patients = await Promise.all(ids.map((id) => this.summary(id, facilityId, now)));
    return { kind, patients };
  }

  private whereFor(kind: LookupKind, value: string, facilityId: string): Prisma.PatientWhereInput {
    switch (kind) {
      case 'NATIONAL_ID':
        return { nationalId: value };
      case 'HEALTH_INSURANCE':
        return { healthInsuranceNumber: value };
      case 'PHONE_OR_INSURANCE':
        return { OR: [{ phone: value }, { healthInsuranceNumber: value }] };
      case 'APPOINTMENT_CODE':
        // Mã lịch hẹn chỉ tra trong cơ sở của mình
        return { appointments: { some: { code: value, facilityId } } };
      case 'NAME':
        return {
          AND: [{ fullName: { contains: value, mode: 'insensitive' } }, linkedTo(facilityId)],
        };
    }
  }

  /** Tóm tắt bệnh nhân cho bác sĩ: định danh, dị ứng, các lần khám gần đây (mọi cơ sở), lịch hẹn & phiếu khám hôm nay. */
  private async summary(patientId: string, facilityId: string, now: Date) {
    const dayStart = vnStartOfDay(vnDateOf(now));
    const [patient, recentVisits, totalVisits, todayAppointment, openEncounter] = await Promise.all(
      [
        this.prisma.patient.findUniqueOrThrow({ where: { id: patientId }, select: summarySelect }),
        this.prisma.medicalRecord.findMany({
          where: { patientId, status: 'FINALIZED' },
          orderBy: { visitAt: 'desc' },
          take: RECENT_VISITS,
          select: {
            id: true,
            code: true,
            visitAt: true,
            chiefComplaint: true,
            facility: { select: { id: true, name: true } },
            specialty: { select: { name: true } },
            doctor: {
              select: { fullName: true, staffProfile: { select: { academicTitle: true } } },
            },
            diagnoses: {
              select: { icdCode: true, isPrimary: true, icd10: { select: { nameVi: true } } },
              orderBy: [{ isPrimary: 'desc' }, { icdCode: 'asc' }],
            },
          },
        }),
        this.prisma.medicalRecord.count({ where: { patientId, status: 'FINALIZED' } }),
        this.prisma.appointment.findFirst({
          where: {
            patientId,
            facilityId,
            startAt: { gte: dayStart, lt: addMinutes(dayStart, 24 * 60) },
            status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
          },
          orderBy: { startAt: 'asc' },
          select: {
            id: true,
            code: true,
            startAt: true,
            status: true,
            reason: true,
            specialty: { select: { name: true } },
          },
        }),
        this.prisma.medicalRecord.findFirst({
          where: { patientId, facilityId, status: 'DRAFT' },
          orderBy: { createdAt: 'desc' },
          select: { id: true, code: true, createdAt: true },
        }),
      ],
    );
    const { userId, ...rest } = patient;
    return {
      ...rest,
      hasAccount: userId !== null,
      recentVisits: recentVisits.map((v) => ({
        id: v.id,
        code: v.code,
        visitAt: v.visitAt,
        chiefComplaint: v.chiefComplaint,
        facility: v.facility,
        atThisFacility: v.facility.id === facilityId,
        specialty: v.specialty?.name ?? null,
        doctor: v.doctor.staffProfile?.academicTitle
          ? `${v.doctor.staffProfile.academicTitle}. ${v.doctor.fullName}`
          : v.doctor.fullName,
        diagnoses: v.diagnoses.map((d) => ({
          icdCode: d.icdCode,
          name: d.icd10.nameVi,
          isPrimary: d.isPrimary,
        })),
      })),
      totalVisits,
      todayAppointment,
      openEncounter,
    };
  }

  /** Quầy tiếp đón tạo hồ sơ cho bệnh nhân vãng lai (chưa có tài khoản). */
  async create(user: AuthUser, input: CreatePatientInput) {
    this.requireFacility(user);
    if (input.communeCode) {
      const exists = await this.prisma.commune.findUnique({
        where: { code: input.communeCode },
        select: { code: true },
      });
      if (!exists) throw new BadRequestException('Xã/phường không tồn tại');
    }
    const { dateOfBirth, healthInsuranceExpiry, ...rest } = input;
    try {
      const patient = await this.prisma.patient.create({
        data: {
          ...rest,
          dateOfBirth: new Date(dateOfBirth),
          healthInsuranceExpiry: healthInsuranceExpiry ? new Date(healthInsuranceExpiry) : null,
        },
        select: { id: true, fullName: true },
      });
      await this.audit.log({
        userId: user.id,
        action: 'CREATE',
        entityType: 'Patient',
        entityId: patient.id,
      });
      return patient;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'Đã có hồ sơ với số CCCD hoặc mã BHYT này — hãy tra cứu để dùng hồ sơ có sẵn',
        );
      }
      throw error;
    }
  }

  private requireFacility(user: AuthUser): string {
    if (!user.facilityId) throw new BadRequestException('Tài khoản chưa gắn cơ sở công tác');
    return user.facilityId;
  }
}
