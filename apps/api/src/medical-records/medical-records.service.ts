import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AccessPolicyService } from '../access/access-policy.service.js';
import { AuditService } from '../audit/audit.service.js';
import { ClinicalImagesService } from '../clinical-images/clinical-images.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { verifyPassword } from '../auth/password.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { computeRecordSignature } from './signature.js';
import type { UpdateRecordInput } from './medical-records.schemas.js';

/** Chức danh được ký hồ sơ khám (bác sĩ, y sĩ) */
const SIGNER_POSITIONS = ['DOCTOR', 'PHYSICIAN_ASSISTANT'] as const;

const recordSelect = {
  id: true,
  code: true,
  status: true,
  encounterType: true,
  visitAt: true,
  createdAt: true,
  updatedAt: true,
  chiefComplaint: true,
  symptoms: true,
  physicalExamination: true,
  pulse: true,
  temperature: true,
  systolicBp: true,
  diastolicBp: true,
  respiratoryRate: true,
  spo2: true,
  weightKg: true,
  heightCm: true,
  diagnosisNote: true,
  treatmentPlan: true,
  followUpDate: true,
  signedAt: true,
  signatureHash: true,
  facilityId: true,
  patientId: true,
  doctorId: true,
  specialty: { select: { id: true, code: true, name: true } },
  facility: { select: { id: true, name: true } },
  doctor: {
    select: {
      id: true,
      fullName: true,
      staffProfile: { select: { academicTitle: true, position: true } },
    },
  },
  appointment: { select: { id: true, code: true, startAt: true, status: true } },
  patient: {
    select: {
      id: true,
      fullName: true,
      dateOfBirth: true,
      gender: true,
      nationalId: true,
      healthInsuranceNumber: true,
      bloodType: true,
      allergies: true,
      chronicConditions: true,
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
      cloudinaryPublicId: true,
      description: true,
      takenAt: true,
      width: true,
      height: true,
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.MedicalRecordSelect;

type RecordRow = Prisma.MedicalRecordGetPayload<{ select: typeof recordSelect }>;

@Injectable()
export class MedicalRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AccessPolicyService,
    private readonly audit: AuditService,
    private readonly images: ClinicalImagesService,
  ) {}

  /** Phiếu khám nháp đang mở tại cơ sở (hàng đợi khám). */
  listOpen(user: AuthUser) {
    if (!user.facilityId) throw new BadRequestException('Tài khoản chưa gắn cơ sở công tác');
    return this.prisma.medicalRecord.findMany({
      where: { facilityId: user.facilityId, status: 'DRAFT' },
      select: {
        id: true,
        code: true,
        createdAt: true,
        encounterType: true,
        chiefComplaint: true,
        specialty: { select: { name: true } },
        doctor: { select: { id: true, fullName: true } },
        appointment: { select: { code: true, startAt: true } },
        patient: {
          select: { id: true, fullName: true, dateOfBirth: true, gender: true, allergies: true },
        },
      },
      // Cấp cứu lên đầu, sau đó theo thứ tự đến
      orderBy: [{ encounterType: 'desc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Xem phiếu khám: nhân viên cơ sở lập phiếu xem được cả nháp; người khác chỉ xem hồ sơ đã ký
   * theo chính sách truy cập bệnh nhân. Không có quyền → 404 (không lộ sự tồn tại).
   */
  async get(id: string, user: AuthUser) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id },
      select: recordSelect,
    });
    if (!record) throw new NotFoundException('Không tìm thấy phiếu khám');
    const sameFacility = !!user.facilityId && record.facilityId === user.facilityId;
    const allowed =
      user.role === 'ADMIN' ||
      sameFacility ||
      (record.status === 'FINALIZED' &&
        (await this.policy.canAccessPatient(user, record.patientId)));
    if (!allowed) throw new NotFoundException('Không tìm thấy phiếu khám');
    await this.audit.log({
      userId: user.id,
      action: 'VIEW',
      entityType: 'MedicalRecord',
      entityId: id,
    });
    return this.toDto(record);
  }

  /** Lưu nháp. Chỉ nhân viên cơ sở lập phiếu, chỉ khi chưa ký. */
  async update(id: string, user: AuthUser, input: UpdateRecordInput) {
    const record = await this.loadDraft(id, user);
    const { diagnoses, prescriptionItems, followUpDate, specialtyId, ...fields } = input;

    if (diagnoses?.length) {
      const codes = diagnoses.map((d) => d.icdCode);
      const found = await this.prisma.icd10Code.findMany({
        where: { code: { in: codes }, isActive: true },
        select: { code: true },
      });
      const missing = codes.filter((c) => !found.some((f) => f.code === c));
      if (missing.length)
        throw new BadRequestException(`Mã ICD-10 không có trong danh mục: ${missing.join(', ')}`);
    }
    if (specialtyId) {
      const offered = await this.prisma.facilitySpecialty.findUnique({
        where: { facilityId_specialtyId: { facilityId: record.facilityId, specialtyId } },
      });
      if (!offered) throw new BadRequestException('Cơ sở không có chuyên khoa này');
    }

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.medicalRecord.updateMany({
        where: { id, status: 'DRAFT' },
        data: {
          ...fields,
          ...(specialtyId !== undefined && { specialtyId }),
          ...(followUpDate !== undefined && {
            followUpDate: followUpDate ? new Date(followUpDate) : null,
          }),
        },
      });
      if (count === 0) throw new ConflictException('Phiếu khám đã được ký, không thể sửa');
      if (diagnoses) {
        await tx.diagnosis.deleteMany({ where: { medicalRecordId: id } });
        if (diagnoses.length)
          await tx.diagnosis.createMany({
            data: diagnoses.map((d) => ({ ...d, medicalRecordId: id })),
          });
      }
      if (prescriptionItems) {
        await tx.prescriptionItem.deleteMany({ where: { medicalRecordId: id } });
        if (prescriptionItems.length) {
          await tx.prescriptionItem.createMany({
            data: prescriptionItems.map((p, i) => ({ ...p, medicalRecordId: id, sortOrder: i })),
          });
        }
      }
    });
    await this.audit.log({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'MedicalRecord',
      entityId: id,
      metadata: { fields: Object.keys(input) },
    });
    return this.get(id, user);
  }

  /**
   * Ký xác nhận hoàn tất khám: bác sĩ/y sĩ nhập lại mật khẩu; hệ thống tự ghi bác sĩ đang đăng nhập
   * vào hồ sơ, tính mã băm SHA-256 nội dung và khoá hồ sơ. Lịch hẹn gắn kèm chuyển "Đã khám".
   */
  async sign(id: string, user: AuthUser, password: string) {
    const record = await this.loadDraft(id, user);
    const signer = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true, staffProfile: { select: { position: true } } },
    });
    const position = signer.staffProfile?.position;
    if (!position || !(SIGNER_POSITIONS as readonly string[]).includes(position)) {
      throw new ForbiddenException('Chỉ bác sĩ hoặc y sĩ mới được ký hồ sơ khám');
    }
    if (!(await verifyPassword(password, signer.passwordHash))) {
      await this.audit.log({
        userId: user.id,
        action: 'ACCESS_DENIED',
        entityType: 'MedicalRecord',
        entityId: id,
        metadata: { reason: 'sign-wrong-password' },
      });
      throw new UnauthorizedException('Mật khẩu không đúng, chưa ký hồ sơ');
    }

    const full = await this.prisma.medicalRecord.findUniqueOrThrow({
      where: { id },
      include: { diagnoses: true, prescriptionItems: { orderBy: { sortOrder: 'asc' } } },
    });
    const problems = [
      !full.chiefComplaint && 'lý do khám',
      full.diagnoses.length === 0 && 'chẩn đoán',
      full.diagnoses.length > 0 && !full.diagnoses.some((d) => d.isPrimary) && 'bệnh chính',
    ].filter(Boolean);
    if (problems.length) throw new BadRequestException(`Chưa thể ký: thiếu ${problems.join(', ')}`);

    const signedAt = new Date();
    const signatureHash = computeRecordSignature({ ...full, doctorId: user.id });
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.medicalRecord.updateMany({
        where: { id, status: 'DRAFT' },
        data: { status: 'FINALIZED', doctorId: user.id, signedAt, signatureHash },
      });
      if (count === 0) throw new ConflictException('Phiếu khám đã được ký');
      if (record.appointmentId) {
        await tx.appointment.updateMany({
          where: { id: record.appointmentId, status: 'CHECKED_IN' },
          data: { status: 'COMPLETED' },
        });
      }
    });
    await this.audit.log({
      userId: user.id,
      action: 'SIGN',
      entityType: 'MedicalRecord',
      entityId: id,
      metadata: { signatureHash },
    });
    return this.get(id, user);
  }

  /** Kiểm tra toàn vẹn: tính lại mã băm và so với mã đã lưu lúc ký. */
  async verify(id: string, user: AuthUser) {
    await this.get(id, user); // kiểm tra quyền
    const full = await this.prisma.medicalRecord.findUniqueOrThrow({
      where: { id },
      include: { diagnoses: true, prescriptionItems: { orderBy: { sortOrder: 'asc' } } },
    });
    if (full.status !== 'FINALIZED' || !full.signatureHash) return { signed: false, valid: false };
    return {
      signed: true,
      valid: computeRecordSignature(full) === full.signatureHash,
      signedAt: full.signedAt,
    };
  }

  private async loadDraft(id: string, user: AuthUser) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id },
      select: { id: true, status: true, facilityId: true, appointmentId: true },
    });
    if (!record || !user.facilityId || record.facilityId !== user.facilityId) {
      throw new NotFoundException('Không tìm thấy phiếu khám');
    }
    if (record.status !== 'DRAFT')
      throw new ConflictException('Phiếu khám đã được ký, không thể sửa');
    return record;
  }

  private toDto(r: RecordRow) {
    const { doctor, diagnoses, clinicalImages, ...rest } = r;
    return {
      ...rest,
      clinicalImages: clinicalImages.map((i) => this.images.toDto(i)),
      doctor: {
        id: doctor.id,
        fullName: doctor.fullName,
        academicTitle: doctor.staffProfile?.academicTitle ?? null,
        position: doctor.staffProfile?.position ?? null,
      },
      diagnoses: diagnoses.map((d) => ({
        icdCode: d.icdCode,
        name: d.icd10.nameVi,
        isPrimary: d.isPrimary,
        note: d.note,
      })),
    };
  }
}
