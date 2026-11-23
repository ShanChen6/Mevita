import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { statsQuerySchema, type StatsQuery } from './stats.schemas.js';
import { StatsService } from './stats.service.js';

/** Thống kê toàn hệ thống — chỉ quản trị viên (Sở Y tế). */
@Controller('stats')
@Roles('ADMIN')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('provinces')
  provinces() {
    return this.stats.provinces();
  }

  /** ?from=YYYY-MM-DD&to=YYYY-MM-DD&province=15 */
  @Get('overview')
  overview(@Query(new ZodValidationPipe(statsQuerySchema)) q: StatsQuery) {
    return this.stats.overview(q);
  }
}
