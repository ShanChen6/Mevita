import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccessModule } from './access/access.module.js';
import { AppointmentsModule } from './appointments/appointments.module.js';
import { AdministrativeUnitsModule } from './administrative-units/administrative-units.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CloudinaryModule } from './cloudinary/cloudinary.module.js';
import { validateEnv } from './config/env.validation.js';
import { FacilitiesModule } from './facilities/facilities.module.js';
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
    AdministrativeUnitsModule,
    PatientsModule,
    FacilitiesModule,
    AppointmentsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
