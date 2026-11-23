import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const TTL_MS = 30_000;

/**
 * Trạng thái hoạt động của tài khoản, kiểm tra ở mỗi request có access token.
 * Access token sống 15 phút nên nếu chỉ thu hồi refresh token, tài khoản vừa bị khoá vẫn gọi được API
 * đến khi token hết hạn. Cache 30 giây cho đỡ truy vấn; khoá/mở khoá qua quản trị cập nhật cache ngay.
 * (Nhiều instance API: mỗi instance tự hết hạn cache sau tối đa 30 giây.)
 */
@Injectable()
export class UserStatusService {
  private readonly cache = new Map<string, { active: boolean; until: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async isActive(userId: string): Promise<boolean> {
    const hit = this.cache.get(userId);
    if (hit && hit.until > Date.now()) return hit.active;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true },
    });
    const active = user?.isActive ?? false;
    this.set(userId, active);
    return active;
  }

  set(userId: string, active: boolean) {
    if (this.cache.size > 50_000) this.cache.clear();
    this.cache.set(userId, { active, until: Date.now() + TTL_MS });
  }
}
