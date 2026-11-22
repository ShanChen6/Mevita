import { Injectable, NotFoundException } from '@nestjs/common';
import { toCodeName } from '../common/vietnamese.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListCommunesQuery, ListProvincesQuery } from './administrative-units.schemas.js';

const provinceSelect = {
  code: true,
  name: true,
  nameEn: true,
  fullName: true,
  fullNameEn: true,
  codeName: true,
  type: true,
} satisfies Prisma.ProvinceSelect;

const communeSelect = {
  ...provinceSelect,
  provinceCode: true,
} satisfies Prisma.CommuneSelect;

const UNIT_PREFIX = /^(thanh_pho|tinh|phuong|xa|dac_khu)_/;

/**
 * Điều kiện tìm kiếm theo tên: có dấu ("Mường Khương"), không dấu ("muong khuong"),
 * hoặc kèm loại đơn vị ("Xã Mường Khương", "xa muong khuong").
 */
function nameFilter(q: string) {
  const codeName = toCodeName(q).replace(UNIT_PREFIX, '');
  return [
    { name: { contains: q, mode: 'insensitive' as const } },
    { fullName: { contains: q, mode: 'insensitive' as const } },
    ...(codeName ? [{ codeName: { contains: codeName } }] : []),
  ];
}

@Injectable()
export class AdministrativeUnitsService {
  constructor(private readonly prisma: PrismaService) {}

  listProvinces({ q, type }: ListProvincesQuery) {
    return this.prisma.province.findMany({
      where: { type, ...(q && { OR: nameFilter(q) }) },
      select: { ...provinceSelect, _count: { select: { communes: true } } },
      orderBy: { code: 'asc' },
    });
  }

  async getProvince(code: string) {
    const province = await this.prisma.province.findUnique({
      where: { code },
      select: { ...provinceSelect, _count: { select: { communes: true } } },
    });
    if (!province) throw new NotFoundException(`Không tìm thấy tỉnh/thành có mã ${code}`);
    return province;
  }

  async listCommunes({ q, type, provinceCode, limit }: ListCommunesQuery) {
    if (provinceCode) await this.getProvince(provinceCode);
    return this.prisma.commune.findMany({
      where: { type, provinceCode, ...(q && { OR: nameFilter(q) }) },
      select: communeSelect,
      orderBy: [{ provinceCode: 'asc' }, { code: 'asc' }],
      take: limit,
    });
  }

  async getCommune(code: string) {
    const commune = await this.prisma.commune.findUnique({
      where: { code },
      select: { ...communeSelect, province: { select: provinceSelect } },
    });
    if (!commune) throw new NotFoundException(`Không tìm thấy xã/phường có mã ${code}`);
    return commune;
  }
}
