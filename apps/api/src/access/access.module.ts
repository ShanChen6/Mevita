import { Global, Module } from '@nestjs/common';
import { AccessPolicyService } from './access-policy.service.js';
import { PatientAccessGuard } from './patient-access.guard.js';

@Global()
@Module({
  providers: [AccessPolicyService, PatientAccessGuard],
  exports: [AccessPolicyService, PatientAccessGuard],
})
export class AccessModule {}
