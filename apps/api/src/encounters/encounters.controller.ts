import { Body, Controller, Post } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { startEncounterSchema, type StartEncounterInput } from './encounters.schemas.js';
import { EncountersService } from './encounters.service.js';

@Controller('encounters')
export class EncountersController {
  constructor(private readonly encounters: EncountersService) {}

  /** Bắt đầu khám cho bệnh nhân đến trực tiếp — tạo phiếu khám nháp */
  @Roles('COMMUNE_STAFF', 'PROVINCE_STAFF')
  @Post()
  start(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(startEncounterSchema)) body: StartEncounterInput,
  ) {
    return this.encounters.start(user, body);
  }
}
