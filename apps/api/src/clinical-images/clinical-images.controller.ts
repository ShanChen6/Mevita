import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  confirmImageSchema,
  uploadTicketSchema,
  type ConfirmImageInput,
} from './clinical-images.schemas.js';
import { ClinicalImagesService } from './clinical-images.service.js';

@Controller('medical-records/:recordId/images')
@Roles('COMMUNE_STAFF', 'PROVINCE_STAFF')
export class ClinicalImagesController {
  constructor(private readonly images: ClinicalImagesService) {}

  /** Vé upload có chữ ký — trình duyệt tải ảnh thẳng lên Cloudinary */
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(200)
  @Post('upload-ticket')
  ticket(
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(uploadTicketSchema)) _body: unknown,
  ) {
    return this.images.createTicket(recordId, user);
  }

  /** Xác nhận ảnh đã tải lên và gắn vào hồ sơ */
  @Post()
  confirm(
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(confirmImageSchema)) body: ConfirmImageInput,
  ) {
    return this.images.confirm(recordId, user, body);
  }

  @HttpCode(204)
  @Delete(':imageId')
  async remove(
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.images.remove(recordId, imageId, user);
  }
}
