import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PatientAccess, PatientAccessGuard } from '../access/patient-access.guard.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { PatientLookupService } from './patient-lookup.service.js';
import {
  createPatientSchema,
  listRecordsQuerySchema,
  lookupQuerySchema,
  type CreatePatientInput,
  type LookupQuery,
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
  constructor(
    private readonly patients: PatientsService,
    private readonly lookupService: PatientLookupService,
  ) {}

  /** Tra cứu nhanh tại quầy: CCCD, BHYT, SĐT, mã lịch hẹn (toàn hệ thống) hoặc tên (bệnh nhân của cơ sở) */
  @Roles('COMMUNE_STAFF', 'PROVINCE_STAFF')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('lookup')
  lookup(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(lookupQuerySchema)) query: LookupQuery,
  ) {
    return this.lookupService.lookup(user, query.q);
  }

  /** Quầy tiếp đón tạo hồ sơ bệnh nhân vãng lai */
  @Roles('COMMUNE_STAFF', 'PROVINCE_STAFF')
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createPatientSchema)) body: CreatePatientInput,
  ) {
    return this.lookupService.create(user, body);
  }

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
