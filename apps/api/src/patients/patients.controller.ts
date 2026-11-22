import { Controller, ForbiddenException, Get, Param, UseGuards } from '@nestjs/common';
import { PatientAccess, PatientAccessGuard } from '../access/patient-access.guard.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { PatientsService } from './patients.service.js';

@Controller('patients')
@UseGuards(PatientAccessGuard)
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  /** Hồ sơ của chính bệnh nhân đang đăng nhập */
  @Roles('PATIENT')
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    if (!user.patientId) throw new ForbiddenException('Tài khoản chưa gắn hồ sơ bệnh nhân');
    return this.patients.getSummary(user.patientId, user);
  }

  @PatientAccess('id')
  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.patients.getSummary(id, user);
  }
}
