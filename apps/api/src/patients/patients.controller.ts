import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PatientAccess, PatientAccessGuard } from '../access/patient-access.guard.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  listRecordsQuerySchema,
  updateMyProfileSchema,
  type ListRecordsQuery,
  type UpdateMyProfileInput,
} from './patients.schemas.js';
import { PatientsService } from './patients.service.js';

function requirePatient(user: AuthUser): AuthUser & { patientId: string } {
  if (!user.patientId) throw new ForbiddenException('Tài khoản chưa gắn hồ sơ bệnh nhân');
  return user as AuthUser & { patientId: string };
}

@Controller('patients')
@UseGuards(PatientAccessGuard)
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  /** Hồ sơ sức khoẻ của bệnh nhân đang đăng nhập */
  @Roles('PATIENT')
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.patients.getProfile(requirePatient(user).patientId, user);
  }

  @Roles('PATIENT')
  @Patch('me')
  updateMe(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateMyProfileSchema)) body: UpdateMyProfileInput,
  ) {
    return this.patients.updateMyProfile(requirePatient(user), body);
  }

  /** Lịch sử khám bệnh của bệnh nhân đang đăng nhập */
  @Roles('PATIENT')
  @Get('me/records')
  myRecords(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listRecordsQuerySchema)) query: ListRecordsQuery,
  ) {
    return this.patients.listRecords(requirePatient(user).patientId, user, query);
  }

  @PatientAccess('id')
  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.patients.getProfile(id, user);
  }

  /** Lịch sử khám của một bệnh nhân (bác sĩ có quyền theo chính sách truy cập) */
  @PatientAccess('id')
  @Get(':id/records')
  records(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listRecordsQuerySchema)) query: ListRecordsQuery,
  ) {
    return this.patients.listRecords(id, user, query);
  }
}
