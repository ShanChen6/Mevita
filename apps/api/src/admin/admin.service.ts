import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListAuditQuery, ListUsersQuery } from './admin.schemas.js';

const PAGE = 30;

/** Quản trị tài khoản & nhật ký truy cập (Task 5.2). */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async users({ q, role, status, page }: ListUsersQuery) {
    const where: Prisma.UserWhereInput = {
      ...(role && { role }),
      ...(status && { isActive: status === 'active' }),
      ...(q && {
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
        ],
      }),
    };
    const [total, items] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          phone: true,
          fullName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          staffProfile: {
            select: { position: true, academicTitle: true, facility: { select: { name: true } } },
          },
        },
        orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
        skip: (page - 1) * PAGE,
        take: PAGE,
      }),
    ]);
    return { total, page, pageSize: PAGE, items };
  }

  /** Khoá / mở khoá tài khoản. Khoá thì thu hồi mọi phiên đăng nhập (refresh token). */
  async setActive(id: string, isActive: boolean, admin: AuthUser) {
    if (id === admin.id) throw new BadRequestException('Không thể tự khoá tài khoản của mình');
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    const now = new Date();
    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { isActive },
        select: { id: true, isActive: true },
      }),
      ...(isActive
        ? []
        : [
            this.prisma.refreshToken.updateMany({
              where: { userId: id, revokedAt: null },
              data: { revokedAt: now },
            }),
          ]),
    ]);
    await this.audit.log({
      userId: admin.id,
      action: 'UPDATE',
      entityType: 'User',
      entityId: id,
      metadata: { isActive },
    });
    return updated;
  }

  async auditLogs({ action, entityType, q, cursor, limit }: ListAuditQuery) {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...(action && { action }),
        ...(entityType && { entityType }),
        ...(q && {
          user: {
            OR: [
              { fullName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
        }),
      },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        ipAddress: true,
        createdAt: true,
        user: { select: { id: true, fullName: true, email: true, role: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
  }

  /** Giá trị có trong nhật ký — cho bộ lọc. */
  async auditFacets() {
    const [actions, entities] = await Promise.all([
      this.prisma.auditLog.findMany({
        distinct: ['action'],
        select: { action: true },
        orderBy: { action: 'asc' },
      }),
      this.prisma.auditLog.findMany({
        distinct: ['entityType'],
        select: { entityType: true },
        orderBy: { entityType: 'asc' },
      }),
    ]);
    return {
      actions: actions.map((a) => a.action),
      entityTypes: entities.map((e) => e.entityType),
    };
  }
}
