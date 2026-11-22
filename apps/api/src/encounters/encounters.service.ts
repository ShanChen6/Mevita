import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { generateCode } from '../common/codes.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { StartEncounterInput } from './encounters.schemas.js';

@Injectable()
export class EncountersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Mở phiếu khám (hồ sơ nháp) tại cơ sở của nhân viên cho bệnh nhân đang có mặt.
   * Nếu bệnh nhân đã có phiếu nháp chưa ký tại cơ sở thì trả lại phiếu đó (không tạo trùng).
   * Việc mở phiếu xác lập liên hệ bệnh nhân – cơ sở, nên được ghi audit.
   */
  async start(user: AuthUser, input: StartEncounterInput) {
    if (!user.facilityId) throw new BadRequestException('Tài khoản chưa gắn cơ sở công tác');
    const facilityId = user.facilityId;

    const patient = await this.prisma.patient.findUnique({
      where: { id: input.patientId },
      select: { id: true },
    });
    if (!patient) throw new NotFoundException('Không tìm thấy bệnh nhân');
    if (input.specialtyId) {
      const offered = await this.prisma.facilitySpecialty.findUnique({
        where: { facilityId_specialtyId: { facilityId, specialtyId: input.specialtyId } },
      });
      if (!offered) throw new BadRequestException('Cơ sở không có chuyên khoa này');
    }

    const existing = await this.prisma.medicalRecord.findFirst({
      where: { patientId: input.patientId, facilityId, status: 'DRAFT' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, code: true, createdAt: true },
    });
    if (existing) return { ...existing, created: false };

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const record = await this.prisma.medicalRecord.create({
          data: {
            code: generateCode('BA'),
            patientId: input.patientId,
            facilityId,
            doctorId: user.id,
            specialtyId: input.specialtyId ?? null,
            encounterType: input.encounterType,
            chiefComplaint: input.chiefComplaint,
          },
          select: { id: true, code: true, createdAt: true },
        });
        await this.audit.log({
          userId: user.id,
          action: 'CREATE',
          entityType: 'MedicalRecord',
          entityId: record.id,
          metadata: { patientId: input.patientId, walkIn: true },
        });
        return { ...record, created: true };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
          continue;
        throw error;
      }
    }
    throw new ConflictException('Không tạo được phiếu khám, vui lòng thử lại');
  }
}
