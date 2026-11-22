import {
  ForbiddenException,
  Injectable,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { AccessPolicyService } from './access-policy.service.js';

const PATIENT_PARAM_KEY = 'patientParam';

/**
 * Bảo vệ route có tham số mã bệnh nhân: chỉ người có quyền theo `AccessPolicyService` mới vào được.
 * @example @PatientAccess('id') @Get('patients/:id')
 */
export const PatientAccess = (param = 'patientId') => SetMetadata(PATIENT_PARAM_KEY, param);

const uuid = z.uuid();

@Injectable()
export class PatientAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly policy: AccessPolicyService,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const param = this.reflector.get<string | undefined>(PATIENT_PARAM_KEY, context.getHandler());
    if (!param) return true;

    const request = context.switchToHttp().getRequest<Request & { user: AuthUser }>();
    const patientId = request.params[param];
    // Mã không hợp lệ cũng trả 403 (không phải 404) để không lộ việc hồ sơ có tồn tại hay không
    if (typeof patientId !== 'string' || !uuid.safeParse(patientId).success) {
      throw new ForbiddenException('Bạn không có quyền truy cập hồ sơ bệnh nhân này');
    }

    if (await this.policy.canAccessPatient(request.user, patientId)) return true;

    await this.audit.log({
      userId: request.user.id,
      action: 'ACCESS_DENIED',
      entityType: 'Patient',
      entityId: patientId,
      ipAddress: request.ip,
    });
    throw new ForbiddenException('Bạn không có quyền truy cập hồ sơ bệnh nhân này');
  }
}
