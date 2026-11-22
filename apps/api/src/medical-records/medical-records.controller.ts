import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  signRecordSchema,
  updateRecordSchema,
  type SignRecordInput,
  type UpdateRecordInput,
} from './medical-records.schemas.js';
import { MedicalRecordsService } from './medical-records.service.js';

@Controller('medical-records')
export class MedicalRecordsController {
  constructor(private readonly records: MedicalRecordsService) {}

  /** Hàng đợi khám: phiếu nháp đang mở tại cơ sở */
  @Roles('COMMUNE_STAFF', 'PROVINCE_STAFF')
  @Get('open')
  open(@CurrentUser() user: AuthUser) {
    return this.records.listOpen(user);
  }

  @Roles('COMMUNE_STAFF', 'PROVINCE_STAFF', 'ADMIN')
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.records.get(id, user);
  }

  @Roles('COMMUNE_STAFF', 'PROVINCE_STAFF')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateRecordSchema)) body: UpdateRecordInput,
  ) {
    return this.records.update(id, user, body);
  }

  /** Ký xác nhận hoàn tất khám (nhập lại mật khẩu) */
  @Roles('COMMUNE_STAFF', 'PROVINCE_STAFF')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post(':id/sign')
  sign(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(signRecordSchema)) body: SignRecordInput,
  ) {
    return this.records.sign(id, user, body.password);
  }

  /** Kiểm tra hồ sơ đã ký có bị sửa đổi sau khi ký hay không */
  @Roles('COMMUNE_STAFF', 'PROVINCE_STAFF', 'ADMIN')
  @Get(':id/verify')
  verify(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.records.verify(id, user);
  }
}
