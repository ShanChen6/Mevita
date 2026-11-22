import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { CloudinaryService, type CloudinaryStatus } from '../cloudinary/cloudinary.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface HealthResponse {
  status: 'ok';
  service: 'mevita-api';
  timestamp: string;
  database: 'up' | 'down';
  cloudinary: CloudinaryStatus;
}

@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const [dbUp, cloudinary] = await Promise.all([this.prisma.isHealthy(), this.cloudinary.ping()]);
    return {
      status: 'ok',
      service: 'mevita-api',
      timestamp: new Date().toISOString(),
      database: dbUp ? 'up' : 'down',
      cloudinary,
    };
  }
}
