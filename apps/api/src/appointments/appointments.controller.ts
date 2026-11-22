import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  cancelAppointmentSchema,
  createAppointmentSchema,
  facilityAppointmentsQuerySchema,
  myAppointmentsQuerySchema,
  type CancelAppointmentInput,
  type CreateAppointmentInput,
  type FacilityAppointmentsQuery,
  type MyAppointmentsQuery,
} from './appointments.schemas.js';
import { AppointmentsService } from './appointments.service.js';

function requirePatient(user: AuthUser): AuthUser & { patientId: string } {
  if (!user.patientId) throw new ForbiddenException('Tài khoản chưa gắn hồ sơ bệnh nhân');
  return user as AuthUser & { patientId: string };
}

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Roles('PATIENT')
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createAppointmentSchema)) body: CreateAppointmentInput,
  ) {
    return this.appointments.create(requirePatient(user), body);
  }

  @Roles('PATIENT')
  @Get('me')
  mine(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(myAppointmentsQuerySchema)) query: MyAppointmentsQuery,
  ) {
    return this.appointments.listMine(requirePatient(user).patientId, query);
  }

  /** Lịch hẹn trong ngày của cơ sở nhân viên đang công tác */
  @Roles('COMMUNE_STAFF', 'PROVINCE_STAFF', 'ADMIN')
  @Get('facility')
  forFacility(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(facilityAppointmentsQuerySchema)) query: FacilityAppointmentsQuery,
  ) {
    return this.appointments.listForFacility(user, query);
  }

  @Roles('COMMUNE_STAFF', 'PROVINCE_STAFF', 'ADMIN')
  @HttpCode(200)
  @Post(':id/confirm')
  confirm(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.appointments.confirm(id, user);
  }

  /** Tiếp đón & tạo phiếu khám */
  @Roles('COMMUNE_STAFF', 'PROVINCE_STAFF', 'ADMIN')
  @HttpCode(200)
  @Post(':id/check-in')
  checkIn(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.appointments.checkIn(id, user);
  }

  @Roles('COMMUNE_STAFF', 'PROVINCE_STAFF', 'ADMIN')
  @HttpCode(200)
  @Post(':id/no-show')
  noShow(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.appointments.markNoShow(id, user);
  }

  /** Bệnh nhân huỷ lịch của mình hoặc cơ sở huỷ lịch */
  @HttpCode(200)
  @Post(':id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(cancelAppointmentSchema)) body: CancelAppointmentInput,
  ) {
    return this.appointments.cancel(id, user, body.reason);
  }
}
