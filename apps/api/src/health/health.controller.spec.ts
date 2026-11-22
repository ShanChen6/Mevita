import { Test } from '@nestjs/testing';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('trả về trạng thái ok kèm trạng thái DB và Cloudinary', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: { isHealthy: vi.fn().mockResolvedValue(true) } },
        {
          provide: CloudinaryService,
          useValue: { ping: vi.fn().mockResolvedValue('not_configured') },
        },
      ],
    }).compile();

    const result = await moduleRef.get(HealthController).check();

    expect(result).toMatchObject({
      status: 'ok',
      service: 'mevita-api',
      database: 'up',
      cloudinary: 'not_configured',
    });
  });
});
