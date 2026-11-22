import { Test } from '@nestjs/testing';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('trả về trạng thái ok kèm trạng thái Cloudinary', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: CloudinaryService,
          useValue: { ping: vi.fn().mockResolvedValue('not_configured') },
        },
      ],
    }).compile();

    const result = await moduleRef.get(HealthController).check();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('mevita-api');
    expect(result.cloudinary).toBe('not_configured');
  });
});
