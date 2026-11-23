import { Global, Module } from '@nestjs/common';
import { ClinicalImagesController } from './clinical-images.controller.js';
import { ClinicalImagesService } from './clinical-images.service.js';

@Global()
@Module({
  controllers: [ClinicalImagesController],
  providers: [ClinicalImagesService],
  exports: [ClinicalImagesService],
})
export class ClinicalImagesModule {}
