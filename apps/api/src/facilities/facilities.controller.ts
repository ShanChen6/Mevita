import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  listFacilitiesQuerySchema,
  slotsQuerySchema,
  type ListFacilitiesQuery,
  type SlotsQuery,
} from './facilities.schemas.js';
import { FacilitiesService } from './facilities.service.js';

/** Thông tin công khai phục vụ đặt lịch: cơ sở, chuyên khoa, bác sĩ, khung giờ trống. */
@Public()
@Controller('facilities')
export class FacilitiesController {
  constructor(private readonly facilities: FacilitiesService) {}

  /** GET /api/facilities?provinceCode=&communeCode=&specialtyCode=&q= */
  @Get()
  list(@Query(new ZodValidationPipe(listFacilitiesQuerySchema)) query: ListFacilitiesQuery) {
    return this.facilities.list(query);
  }

  /** Chi tiết cơ sở: chuyên khoa nhận đặt lịch, bác sĩ, giờ làm việc */
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.facilities.get(id);
  }

  /** GET /api/facilities/:id/slots?date=YYYY-MM-DD&specialtyId=&doctorId= */
  @Get(':id/slots')
  slots(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(slotsQuerySchema)) query: SlotsQuery,
  ) {
    return this.facilities.slots(query, id);
  }
}
