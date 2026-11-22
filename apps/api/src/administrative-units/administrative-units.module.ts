import { Module } from '@nestjs/common';
import { AdministrativeUnitsController } from './administrative-units.controller.js';
import { AdministrativeUnitsService } from './administrative-units.service.js';

@Module({
  controllers: [AdministrativeUnitsController],
  providers: [AdministrativeUnitsService],
  exports: [AdministrativeUnitsService],
})
export class AdministrativeUnitsModule {}
