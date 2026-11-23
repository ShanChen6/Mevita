import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AuditEntry {
  userId?: string | null;
  action:
    | 'LOGIN'
    | 'LOGIN_FAILED'
    | 'LOGOUT'
    | 'REGISTER'
    | 'TOKEN_REUSE'
    | 'VIEW'
    | 'LOOKUP'
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE'
    | 'SIGN'
    | 'ACCESS_DENIED'
    | 'ESCALATE';
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}

/** Ghi nhật ký truy cập dữ liệu nhạy cảm. Lỗi ghi log không làm hỏng nghiệp vụ chính. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({ data: entry });
    } catch (error) {
      this.logger.error(`Không ghi được audit log: ${(error as Error).message}`);
    }
  }
}
