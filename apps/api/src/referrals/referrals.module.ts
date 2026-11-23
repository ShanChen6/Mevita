import { Module } from '@nestjs/common';
import { ClinicalImagesModule } from '../clinical-images/clinical-images.module.js';
import { ReferralVitalsGateway } from './referral-vitals.gateway.js';
import { ReferralVitalsService } from './referral-vitals.service.js';
import { ReferralsController } from './referrals.controller.js';
import { ReferralsService } from './referrals.service.js';
import { TransportService } from './transport.service.js';

@Module({
  imports: [ClinicalImagesModule],
  controllers: [ReferralsController],
  providers: [ReferralsService, ReferralVitalsService, ReferralVitalsGateway, TransportService],
  exports: [ReferralsService, ReferralVitalsService],
})
export class ReferralsModule {}
