import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Thông tin định danh & tiền sử của bệnh nhân. Quyền truy cập đã được PatientAccessGuard kiểm tra. */
  async getSummary(patientId: string, viewer: AuthUser) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        fullName: true,
        dateOfBirth: true,
        gender: true,
        nationalId: true,
        healthInsuranceNumber: true,
        phone: true,
        bloodType: true,
        allergies: true,
        chronicConditions: true,
        addressDetail: true,
        commune: {
          select: {
            code: true,
            fullName: true,
            province: { select: { code: true, fullName: true } },
          },
        },
      },
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
}
