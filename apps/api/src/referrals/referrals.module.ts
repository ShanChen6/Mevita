import { Module } from '@nestjs/common';
import { ReferralVitalsGateway } from './referral-vitals.gateway.js';
import { ReferralVitalsService } from './referral-vitals.service.js';
import { ReferralsController } from './referrals.controller.js';
import { ReferralsService } from './referrals.service.js';

@Module({
  controllers: [ReferralsController],
  providers: [ReferralsService, ReferralVitalsService, ReferralVitalsGateway],
  exports: [ReferralsService, ReferralVitalsService],
})
export class ReferralsModule {}
