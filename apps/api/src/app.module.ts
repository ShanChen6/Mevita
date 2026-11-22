import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdministrativeUnitsModule } from './administrative-units/administrative-units.module.js';
import { CloudinaryModule } from './cloudinary/cloudinary.module.js';
import { validateEnv } from './config/env.validation.js';
import { HealthController } from './health/health.controller.js';
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
    CloudinaryModule,
    AdministrativeUnitsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
