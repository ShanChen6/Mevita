import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  acceptReferralSchema,
  cancelReferralSchema,
  dispatchSchema,
  locationBatchSchema,
  transportOptionsSchema,
  type AcceptReferralInput,
  type DestinationsQuery,
  type LocationEntryInput,
  type RejectReferralInput,
  preparationSchema,
  rejectReferralSchema,
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
import { TransportService } from './transport.service.js';

@Controller('referrals')
@Roles('COMMUNE_STAFF', 'PROVINCE_STAFF')
export class ReferralsController {
  constructor(
    private readonly referrals: ReferralsService,
    private readonly vitals: ReferralVitalsService,
    private readonly transport: TransportService,
  ) {}

  /** Bệnh viện tuyến trên có thể chuyển tới (trong tỉnh trước, liên tỉnh sau) */
  @Get('destinations')
  destinations(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(destinationsQuerySchema)) query: DestinationsQuery,
  ) {
    return this.referrals.destinations(user, query);
  }

  /** Nhân viên cơ sở mình (chọn người đi kèm xe) */
  @Get('escorts')
  escorts(@CurrentUser() user: AuthUser) {
    return this.referrals.escorts(user);
  }

  /** Phương án vận chuyển: xe của cơ sở, cơ sở lân cận có thể cử xe đón, thời gian chở ước tính */
  @Get('transport-options')
  transportOptions(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(transportOptionsSchema)) q: { toFacilityId?: string },
  ) {
    return this.transport.options(user, q.toFacilityId);
  }

  /** Yêu cầu xe đón đang chờ mà cơ sở mình có thể nhận */
  @Get('pickup-requests')
  pickupRequests(@CurrentUser() user: AuthUser) {
    return this.transport.pickupRequests(user);
  }

  /** Lệnh chuyển tuyến khẩn cấp → cảnh báo realtime tới bệnh viện đích (+ yêu cầu xe đón nếu cần) */
  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createReferralSchema)) body: CreateReferralInput,
  ) {
    const res = await this.referrals.create(user, body);
    if (body.transportMode !== 'PICKUP') return res;
    const pickup = await this.transport.broadcastPickupRequest(res.referral.id);
    return { ...res, pickup };
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

  /** Tuyến trên: xác nhận tiếp nhận & sẵn sàng ê-kíp */
  @HttpCode(200)
  @Post(':id/accept')
  accept(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(acceptReferralSchema)) body: AcceptReferralInput,
  ) {
    return this.referrals.accept(id, user, body);
  }

  /** Tuyến trên: cập nhật ghi chú chuẩn bị sau khi đã tiếp nhận */
  @Patch(':id/preparation')
  preparation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(preparationSchema)) body: { preparationNote: string },
  ) {
    return this.referrals.updatePreparation(id, user, body.preparationNote);
  }

  /** Tuyến trên: không thể tiếp nhận */
  @HttpCode(200)
  @Post(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(rejectReferralSchema)) body: RejectReferralInput,
  ) {
    return this.referrals.reject(id, user, body);
  }

  /** Tuyến trên: xe đã tới — tiếp nhận bệnh nhân và mở hồ sơ điều trị tiếp nối */
  @HttpCode(200)
  @Post(':id/arrive')
  arrive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.referrals.arrive(id, user);
  }

  /** Cơ sở cử xe đón (cơ sở đầu tiên nhận được giao ca) */
  @HttpCode(200)
  @Post(':id/dispatch')
  dispatch(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(dispatchSchema)) body: { vehicleId: string },
  ) {
    return this.transport.dispatch(id, user, body.vehicleId);
  }

  /** Xe đón đã nhận bệnh nhân tại trạm */
  @HttpCode(200)
  @Post(':id/picked-up')
  pickedUp(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.transport.pickedUp(id, user);
  }

  @Get(':id/locations')
  locations(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.transport.locations(id, user);
  }

  /** Ghi vị trí — dự phòng khi không dùng được socket; idempotent theo clientId */
  @HttpCode(200)
  @Post(':id/locations')
  recordLocations(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(locationBatchSchema)) body: { entries: LocationEntryInput[] },
  ) {
    return this.transport.recordLocations(id, user, body.entries);
  }
}
