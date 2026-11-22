import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  communeCodeSchema,
  listCommunesQuerySchema,
  listProvincesQuerySchema,
  provinceCodeSchema,
  type ListCommunesQuery,
  type ListProvincesQuery,
} from './administrative-units.schemas.js';
import { AdministrativeUnitsService } from './administrative-units.service.js';

@Public()
@Controller()
export class AdministrativeUnitsController {
  constructor(private readonly service: AdministrativeUnitsService) {}

  /** GET /api/provinces?q=&type= — danh sách 34 tỉnh/thành */
  @Get('provinces')
  listProvinces(@Query(new ZodValidationPipe(listProvincesQuerySchema)) query: ListProvincesQuery) {
    return this.service.listProvinces(query);
  }

  /** GET /api/provinces/:code */
  @Get('provinces/:code')
  getProvince(@Param('code', new ZodValidationPipe(provinceCodeSchema)) code: string) {
    return this.service.getProvince(code);
  }

  /** GET /api/provinces/:code/communes?q=&type= — toàn bộ xã/phường của một tỉnh */
  @Get('provinces/:code/communes')
  listCommunesOfProvince(
    @Param('code', new ZodValidationPipe(provinceCodeSchema)) code: string,
    @Query(new ZodValidationPipe(listCommunesQuerySchema.omit({ provinceCode: true, limit: true })))
    query: Omit<ListCommunesQuery, 'provinceCode' | 'limit'>,
  ) {
    return this.service.listCommunes({ ...query, provinceCode: code, limit: 5000 });
  }

  /** GET /api/communes?q=&provinceCode=&type=&limit= — tìm kiếm xã/phường (có dấu hoặc không dấu) */
  @Get('communes')
  listCommunes(@Query(new ZodValidationPipe(listCommunesQuerySchema)) query: ListCommunesQuery) {
    return this.service.listCommunes(query);
  }

  /** GET /api/communes/:code — chi tiết xã/phường kèm tỉnh/thành */
  @Get('communes/:code')
  getCommune(@Param('code', new ZodValidationPipe(communeCodeSchema)) code: string) {
    return this.service.getCommune(code);
  }
}
