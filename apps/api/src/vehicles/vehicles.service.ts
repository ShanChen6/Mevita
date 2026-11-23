import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateVehicleInput, UpdateVehicleInput } from '../referrals/referrals.schemas.js';

const vehicleSelect = {
  id: true,
  plateNumber: true,
  type: true,
  equipment: true,
  driverName: true,
  driverPhone: true,
  status: true,
  isActive: true,
  lastLatitude: true,
  lastLongitude: true,
  lastSeenAt: true,
  referrals: {
    where: { status: { in: ['PENDING', 'ACCEPTED'] as ('PENDING' | 'ACCEPTED')[] } },
    select: {
      id: true,
      code: true,
      priority: true,
      toFacility: { select: { name: true } },
      fromFacility: { select: { name: true } },
    },
    take: 1,
  },
} satisfies Prisma.VehicleSelect;

/** Danh mục xe chuyển viện của cơ sở (Task C). */
@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private facility(user: AuthUser) {
    if (!user.facilityId) throw new BadRequestException('Tài khoản chưa gắn cơ sở công tác');
    return user.facilityId;
  }

  async list(user: AuthUser) {
    const rows = await this.prisma.vehicle.findMany({
      where: { facilityId: this.facility(user) },
      select: vehicleSelect,
      orderBy: [{ isActive: 'desc' }, { status: 'asc' }, { plateNumber: 'asc' }],
    });
    return rows.map(({ referrals, ...v }) => ({ ...v, mission: referrals[0] ?? null }));
  }

  async create(user: AuthUser, input: CreateVehicleInput) {
    try {
      const v = await this.prisma.vehicle.create({
        data: { ...input, facilityId: this.facility(user) },
        select: { id: true, plateNumber: true },
      });
      await this.audit.log({
        userId: user.id,
        action: 'CREATE',
        entityType: 'Vehicle',
        entityId: v.id,
      });
      return v;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
        throw new ConflictException('Biển số đã có trong hệ thống');
      throw e;
    }
  }

  /** Sửa thông tin / chuyển trạng thái Sẵn sàng ↔ Bảo trì. Xe đang làm nhiệm vụ không đổi trạng thái được. */
  async update(id: string, user: AuthUser, input: UpdateVehicleInput) {
    const v = await this.prisma.vehicle.findFirst({
      where: { id, facilityId: this.facility(user) },
      select: { status: true },
    });
    if (!v) throw new NotFoundException('Không tìm thấy xe');
    if ((input.status || input.isActive === false) && v.status === 'ON_MISSION')
      throw new ConflictException('Xe đang làm nhiệm vụ — chờ ca chuyển tuyến kết thúc');
    try {
      await this.prisma.vehicle.update({ where: { id }, data: input });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
        throw new ConflictException('Biển số đã có trong hệ thống');
      throw e;
    }
    await this.audit.log({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Vehicle',
      entityId: id,
      metadata: { fields: Object.keys(input) },
    });
    return (await this.list(user)).find((x) => x.id === id);
  }
}
