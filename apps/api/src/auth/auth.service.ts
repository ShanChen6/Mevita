import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { normalizePhone, type LoginInput, type RegisterInput } from './auth.schemas.js';
import type { AuthUser, TokenPair } from './auth.types.js';
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from './password.js';
import { TokenService, type SessionContext } from './token.service.js';

const userWithLinks = {
  staffProfile: { select: { facilityId: true } },
  patient: { select: { id: true } },
} satisfies Prisma.UserInclude;

type UserWithLinks = Prisma.UserGetPayload<{ include: typeof userWithLinks }>;

const toAuthUser = (u: UserWithLinks): AuthUser => ({
  id: u.id,
  role: u.role,
  facilityId: u.staffProfile?.facilityId ?? null,
  patientId: u.patient?.id ?? null,
});

const INVALID_CREDENTIALS = 'Email/số điện thoại hoặc mật khẩu không đúng';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  /** Bệnh nhân tự đăng ký: tạo tài khoản PATIENT kèm hồ sơ bệnh nhân mới. */
  async register(input: RegisterInput, ctx: SessionContext): Promise<TokenPair> {
    // Không tự liên kết với hồ sơ có sẵn theo CCCD: chỉ biết số CCCD chưa đủ để chứng minh
    // là chủ hồ sơ. Việc liên kết do cơ sở y tế thực hiện sau khi đối chiếu giấy tờ.
    if (input.nationalId) {
      const existing = await this.prisma.patient.findUnique({
        where: { nationalId: input.nationalId },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException(
          'Đã có hồ sơ với số CCCD này. Vui lòng liên hệ cơ sở y tế để liên kết tài khoản.',
        );
      }
    }

    const passwordHash = await hashPassword(input.password);
    let user: UserWithLinks;
    try {
      user = await this.prisma.user.create({
        data: {
          email: input.email,
          phone: input.phone,
          passwordHash,
          fullName: input.fullName,
          role: 'PATIENT',
          patient: {
            create: {
              fullName: input.fullName,
              dateOfBirth: new Date(input.dateOfBirth),
              gender: input.gender,
              nationalId: input.nationalId,
              phone: input.phone,
            },
          },
        },
        include: userWithLinks,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email, số điện thoại hoặc CCCD đã được sử dụng');
      }
      throw error;
    }

    await this.audit.log({
      userId: user.id,
      action: 'REGISTER',
      entityType: 'User',
      entityId: user.id,
      ipAddress: ctx.ipAddress,
    });
    return this.tokens.issue(toAuthUser(user), ctx);
  }

  async login({ identifier, password }: LoginInput, ctx: SessionContext): Promise<TokenPair> {
    const where = identifier.includes('@')
      ? { email: identifier.trim().toLowerCase() }
      : { phone: normalizePhone(identifier) };
    const user = await this.prisma.user.findUnique({ where, include: userWithLinks });

    // Luôn chạy verify (kể cả khi không có tài khoản) để thời gian phản hồi như nhau
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !ok || !user.isActive) {
      await this.audit.log({
        userId: user?.id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user?.id,
        ipAddress: ctx.ipAddress,
      });
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      ipAddress: ctx.ipAddress,
    });
    return this.tokens.issue(toAuthUser(user), ctx);
  }

  /** Đổi refresh token lấy cặp token mới; đọc lại vai trò/cơ sở mới nhất từ DB. */
  async refresh(refreshToken: string, ctx: SessionContext): Promise<TokenPair> {
    const { userId, reused } = await this.tokens.consume(refreshToken);
    if (reused) {
      await this.audit.log({
        userId,
        action: 'TOKEN_REUSE',
        entityType: 'RefreshToken',
        ipAddress: ctx.ipAddress,
      });
      throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi, vui lòng đăng nhập lại');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: userWithLinks,
    });
    if (!user?.isActive) throw new UnauthorizedException('Tài khoản không còn hoạt động');
    return this.tokens.issue(toAuthUser(user), ctx);
  }

  async logout(refreshToken: string, ctx: SessionContext) {
    const userId = await this.tokens.revoke(refreshToken);
    if (userId) {
      await this.audit.log({
        userId,
        action: 'LOGOUT',
        entityType: 'User',
        entityId: userId,
        ipAddress: ctx.ipAddress,
      });
    }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        staffProfile: {
          select: {
            position: true,
            academicTitle: true,
            facility: { select: { id: true, name: true, type: true } },
            specialty: { select: { name: true } },
          },
        },
        patient: { select: { id: true } },
      },
    });
    if (!user) throw new UnauthorizedException('Tài khoản không tồn tại');
    return user;
  }
}
