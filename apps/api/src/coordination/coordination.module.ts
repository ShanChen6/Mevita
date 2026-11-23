import { Module } from '@nestjs/common';
import { CoordinationController } from './coordination.controller.js';
import { CoordinationService } from './coordination.service.js';
import { EscalationService } from './escalation.service.js';

@Module({
  controllers: [CoordinationController],
  providers: [CoordinationService, EscalationService],
  exports: [EscalationService],
})
export class CoordinationModule {}
