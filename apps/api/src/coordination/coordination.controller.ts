import { Body, Controller, Get, Put } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { capacitySchema, type CapacityInput } from '../referrals/referrals.schemas.js';
import { CoordinationService } from './coordination.service.js';

@Controller('coordination')
export class CoordinationController {
  constructor(private readonly coordination: CoordinationService) {}

  /** Năng lực tiếp nhận của cơ sở mình */
  @Get('capacity')
  @Roles('COMMUNE_STAFF', 'PROVINCE_STAFF')
  capacity(@CurrentUser() user: AuthUser) {
    return this.coordination.myCapacity(user);
  }

  @Put('capacity')
  @Roles('PROVINCE_STAFF')
  updateCapacity(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(capacitySchema)) body: CapacityInput,
  ) {
    return this.coordination.updateCapacity(user, body);
  }

  /** Điều phối viên Sở Y tế */
  @Get('overview')
  @Roles('ADMIN')
  overview() {
    return this.coordination.overview();
  }
}
