import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  cancelReferralSchema,
  createReferralSchema,
  vitalBatchSchema,
  type VitalEntryInput,
  destinationsQuerySchema,
  listReferralsQuerySchema,
  type CreateReferralInput,
  type ListReferralsQuery,
} from './referrals.schemas.js';
import { ReferralVitalsService } from './referral-vitals.service.js';
import { ReferralsService } from './referrals.service.js';

@Controller('referrals')
@Roles('COMMUNE_STAFF', 'PROVINCE_STAFF')
export class ReferralsController {
  constructor(
    private readonly referrals: ReferralsService,
    private readonly vitals: ReferralVitalsService,
  ) {}

  /** Bệnh viện tuyến trên có thể chuyển tới (trong tỉnh trước, liên tỉnh sau) */
  @Get('destinations')
  destinations(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(destinationsQuerySchema)) query: { q?: string },
  ) {
    return this.referrals.destinations(user, query.q);
  }

  /** Nhân viên cơ sở mình (chọn người đi kèm xe) */
  @Get('escorts')
  escorts(@CurrentUser() user: AuthUser) {
    return this.referrals.escorts(user);
  }

  /** Lệnh chuyển tuyến khẩn cấp → cảnh báo realtime tới bệnh viện đích */
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createReferralSchema)) body: CreateReferralInput,
  ) {
    return this.referrals.create(user, body);
  }

  /** ?direction=incoming|outgoing&active=true */
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listReferralsQuerySchema)) query: ListReferralsQuery,
  ) {
    return this.referrals.list(user, query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.referrals.get(id, user);
  }

  @HttpCode(200)
  @Post(':id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(cancelReferralSchema)) body: { reason: string },
  ) {
    return this.referrals.cancel(id, user, body.reason);
  }

  /** Diễn biến sinh tồn trên xe (cũ → mới) */
  @Get(':id/vitals')
  listVitals(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.vitals.list(id, user);
  }

  /** Ghi lô chỉ số sinh tồn — dự phòng khi không dùng được kênh socket; idempotent theo clientId */
  @HttpCode(200)
  @Post(':id/vitals')
  recordVitals(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(vitalBatchSchema)) body: { entries: VitalEntryInput[] },
  ) {
    return this.vitals.record(id, user, body.entries);
  }
}
