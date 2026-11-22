import { Controller, Get } from '@nestjs/common';
import { CloudinaryService, type CloudinaryStatus } from '../cloudinary/cloudinary.service.js';

export interface HealthResponse {
  status: 'ok';
  service: 'mevita-api';
  timestamp: string;
  cloudinary: CloudinaryStatus;
}

@Controller('health')
export class HealthController {
  constructor(private readonly cloudinary: CloudinaryService) {}

  @Get()
  async check(): Promise<HealthResponse> {
    return {
      status: 'ok',
      service: 'mevita-api',
      timestamp: new Date().toISOString(),
      cloudinary: await this.cloudinary.ping(),
    };
  }
}
