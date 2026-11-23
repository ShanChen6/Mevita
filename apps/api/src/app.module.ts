import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccessModule } from './access/access.module.js';
import { AppointmentsModule } from './appointments/appointments.module.js';
import { AdministrativeUnitsModule } from './administrative-units/administrative-units.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CloudinaryModule } from './cloudinary/cloudinary.module.js';
import { validateEnv } from './config/env.validation.js';
import { EncountersModule } from './encounters/encounters.module.js';
import { FacilitiesModule } from './facilities/facilities.module.js';
import { Icd10Module } from './icd10/icd10.module.js';
import { MedicalRecordsModule } from './medical-records/medical-records.module.js';
import { ClinicalImagesModule } from './clinical-images/clinical-images.module.js';
import { MediaModule } from './media/media.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { AdminModule } from './admin/admin.module.js';
import { StatsModule } from './stats/stats.module.js';
import { VehiclesModule } from './vehicles/vehicles.module.js';
import { CoordinationModule } from './coordination/coordination.module.js';
import { ReferralsModule } from './referrals/referrals.module.js';
import { HealthController } from './health/health.controller.js';
import { PatientsModule } from './patients/patients.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    AccessModule,
    CloudinaryModule,
    MediaModule,
    ClinicalImagesModule,
    RealtimeModule,
    ReferralsModule,
    StatsModule,
    VehiclesModule,
    CoordinationModule,
    AdminModule,
    AdministrativeUnitsModule,
    PatientsModule,
    FacilitiesModule,
    AppointmentsModule,
    EncountersModule,
    Icd10Module,
    MedicalRecordsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
