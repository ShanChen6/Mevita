import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListRecordsQuery, UpdateMyProfileInput } from './patients.schemas.js';

const profileSelect = {
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
  commune: {
    select: {
      code: true,
      name: true,
      fullName: true,
      province: { select: { code: true, name: true, fullName: true } },
    },
  },
} satisfies Prisma.PatientSelect;

const recordSelect = {
  id: true,
  code: true,
  visitAt: true,
  encounterType: true,
  chiefComplaint: true,
  symptoms: true,
  diagnosisNote: true,
  treatmentPlan: true,
  followUpDate: true,
  pulse: true,
  temperature: true,
  systolicBp: true,
  diastolicBp: true,
  respiratoryRate: true,
  spo2: true,
  weightKg: true,
  heightCm: true,
  signedAt: true,
  specialty: { select: { code: true, name: true } },
  doctor: {
    select: { fullName: true, staffProfile: { select: { academicTitle: true, position: true } } },
  },
  facility: {
    select: {
      id: true,
      name: true,
      type: true,
      commune: { select: { fullName: true, province: { select: { fullName: true } } } },
    },
  },
  diagnoses: {
    select: { icdCode: true, isPrimary: true, note: true, icd10: { select: { nameVi: true } } },
    orderBy: [{ isPrimary: 'desc' }, { icdCode: 'asc' }],
  },
  prescriptionItems: {
    select: {
      drugName: true,
      activeIngredient: true,
      strength: true,
      quantity: true,
      unit: true,
      instructions: true,
      durationDays: true,
    },
    orderBy: { sortOrder: 'asc' },
  },
  clinicalImages: {
    select: {
      id: true,
      type: true,
      secureUrl: true,
      description: true,
      takenAt: true,
      width: true,
      height: true,
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.MedicalRecordSelect;

type RecordRow = Prisma.MedicalRecordGetPayload<{ select: typeof recordSelect }>;

/** Ảnh thu nhỏ qua biến đổi URL của Cloudinary (không cần tải ảnh gốc). */
export function cloudinaryThumbnail(url: string, size = 240): string {
  return url.includes('/upload/')
    ? url.replace('/upload/', `/upload/c_fill,w_${size},h_${size},q_auto,f_auto/`)
    : url;
}

function toRecordDto(r: RecordRow) {
  const { doctor, facility, diagnoses, clinicalImages, ...rest } = r;
  return {
    ...rest,
    doctor: {
      fullName: doctor.fullName,
      academicTitle: doctor.staffProfile?.academicTitle ?? null,
      position: doctor.staffProfile?.position ?? null,
    },
    facility: {
      id: facility.id,
      name: facility.name,
      type: facility.type,
      address: `${facility.commune.fullName}, ${facility.commune.province.fullName}`,
    },
    diagnoses: diagnoses.map((d) => ({
      icdCode: d.icdCode,
      name: d.icd10.nameVi,
      isPrimary: d.isPrimary,
      note: d.note,
    })),
    clinicalImages: clinicalImages.map((img) => ({
      ...img,
      thumbnailUrl: cloudinaryThumbnail(img.secureUrl),
    })),
  };
}

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Thông tin định danh & tiền sử của bệnh nhân. Quyền truy cập đã được PatientAccessGuard kiểm tra. */
  async getProfile(patientId: string, viewer: AuthUser) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: profileSelect,
    });
    if (!patient) throw new NotFoundException('Không tìm thấy bệnh nhân');
    await this.audit.log({
      userId: viewer.id,
      action: 'VIEW',
      entityType: 'Patient',
      entityId: patientId,
    });
    return patient;
  }

  /** Bệnh nhân tự cập nhật hồ sơ của mình. */
  async updateMyProfile(user: AuthUser & { patientId: string }, input: UpdateMyProfileInput) {
    if (input.communeCode) {
      const commune = await this.prisma.commune.findUnique({
        where: { code: input.communeCode },
        select: { code: true },
      });
      if (!commune) throw new BadRequestException('Xã/phường không tồn tại');
    }
    const { dateOfBirth, healthInsuranceExpiry, ...rest } = input;
    const data: Prisma.PatientUncheckedUpdateInput = {
      ...rest,
      ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
      ...(healthInsuranceExpiry !== undefined && {
        healthInsuranceExpiry: healthInsuranceExpiry ? new Date(healthInsuranceExpiry) : null,
      }),
    };

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const patient = await tx.patient.update({
          where: { id: user.patientId },
          data,
          select: profileSelect,
        });
        // Giữ tên tài khoản đồng bộ với tên trên hồ sơ
        if (input.fullName)
          await tx.user.update({ where: { id: user.id }, data: { fullName: input.fullName } });
        return patient;
      });
      await this.audit.log({
        userId: user.id,
        action: 'UPDATE',
        entityType: 'Patient',
        entityId: user.patientId,
        metadata: { fields: Object.keys(input) },
      });
      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = JSON.stringify(error.meta?.target ?? '');
        throw new ConflictException(
          target.includes('health_insurance') || target.includes('healthInsurance')
            ? 'Mã thẻ BHYT đã được dùng cho hồ sơ khác'
            : 'Số CCCD đã được dùng cho hồ sơ khác. Vui lòng liên hệ cơ sở y tế.',
        );
      }
      throw error;
    }
  }

  /**
   * Lịch sử khám bệnh (mới nhất trước), chỉ gồm hồ sơ bác sĩ đã ký xác nhận.
   * Phân trang theo con trỏ: truyền `cursor` = id hồ sơ cuối của trang trước.
   */
  async listRecords(patientId: string, viewer: AuthUser, { limit, cursor }: ListRecordsQuery) {
    const rows = await this.prisma.medicalRecord.findMany({
      where: { patientId, status: 'FINALIZED' },
      select: recordSelect,
      orderBy: [{ visitAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map(toRecordDto);
    await this.audit.log({
      userId: viewer.id,
      action: 'VIEW',
      entityType: 'MedicalRecordList',
      entityId: patientId,
      metadata: { count: items.length },
    });
    return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
  }
}
