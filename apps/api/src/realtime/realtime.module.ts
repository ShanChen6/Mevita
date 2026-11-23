import { Global, Module } from '@nestjs/common';
import { PresenceService } from './presence.service.js';
import { RealtimeTicketService } from './realtime-ticket.service.js';
import { RealtimeController } from './realtime.controller.js';
import { RealtimeGateway } from './realtime.gateway.js';
import { RealtimeService } from './realtime.service.js';

@Global()
@Module({
  controllers: [RealtimeController],
  providers: [RealtimeGateway, RealtimeTicketService, PresenceService, RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
