import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Chính sách truy cập dữ liệu bệnh nhân (RBAC + phạm vi cơ sở y tế).
 *
 * - ADMIN: mọi bệnh nhân.
 * - PATIENT: chỉ hồ sơ của chính mình.
 * - Nhân viên y tế (COMMUNE_STAFF, PROVINCE_STAFF): bệnh nhân có liên hệ với cơ sở công tác —
 *   đã có lịch hẹn hoặc hồ sơ khám tại cơ sở, hoặc có phiếu chuyển tuyến gửi đi từ / tới cơ sở.
 *   Khi đã có liên hệ, nhân viên được xem toàn bộ lịch sử khám (kể cả ở cơ sở khác) để điều trị.
 */
@Injectable()
export class AccessPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async canAccessPatient(user: AuthUser, patientId: string): Promise<boolean> {
    switch (user.role) {
      case 'ADMIN':
        return true;
      case 'PATIENT':
        return user.patientId === patientId;
      case 'COMMUNE_STAFF':
      case 'PROVINCE_STAFF': {
        if (!user.facilityId) return false;
        const facilityId = user.facilityId;
        const [record, appointment, referral] = await Promise.all([
          this.prisma.medicalRecord.findFirst({
            where: { patientId, facilityId },
            select: { id: true },
          }),
          this.prisma.appointment.findFirst({
            where: { patientId, facilityId },
            select: { id: true },
          }),
          this.prisma.referral.findFirst({
            where: {
              patientId,
              status: { not: 'CANCELLED' },
              OR: [{ toFacilityId: facilityId }, { fromFacilityId: facilityId }],
            },
            select: { id: true },
          }),
        ]);
        return Boolean(record ?? appointment ?? referral);
      }
      default:
        return false;
    }
  }
}
