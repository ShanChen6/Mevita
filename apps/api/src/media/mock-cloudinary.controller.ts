import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  NotFoundException,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator.js';
import { MEDIA_RULES, MEDIA_STORAGE, type MediaStorage } from './media-storage.js';
import { MockStorage, MockUploadError } from './mock-storage.js';

/**
 * Điểm cuối giả lập Cloudinary (chỉ hoạt động ở chế độ mock).
 * Trình duyệt gửi upload tới đây giống hệt khi gửi tới api.cloudinary.com.
 */
@Public()
@Controller('mock-cloudinary')
export class MockCloudinaryController {
  constructor(@Inject(MEDIA_STORAGE) private readonly storage: MediaStorage) {}

  private mock(): MockStorage {
    if (!(this.storage instanceof MockStorage)) throw new NotFoundException();
    return this.storage;
  }

  @Post('image/upload')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MEDIA_RULES.maxBytes + 1, files: 1 } }),
  )
  async upload(@Body() fields: Record<string, string>, @UploadedFile() file?: { buffer: Buffer }) {
    try {
      return await this.mock().receive(fields, file?.buffer);
    } catch (error) {
      if (error instanceof MockUploadError)
        throw new HttpException({ error: { message: error.message } }, error.status);
      throw error;
    }
  }

  @Get('file')
  async file(
    @Query('id') id = '',
    @Query('v') variant = '',
    @Query('sig') sig = '',
    @Res() res: Response,
  ) {
    const found = await this.mock().read(id, variant, sig);
    if (!found) throw new NotFoundException();
    res.setHeader('Content-Type', found.mime);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(found.data);
  }
}
