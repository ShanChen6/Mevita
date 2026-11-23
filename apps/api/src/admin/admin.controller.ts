import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  listAuditSchema,
  listUsersSchema,
  setActiveSchema,
  type ListAuditQuery,
  type ListUsersQuery,
} from './admin.schemas.js';
import { AdminService } from './admin.service.js';

@Controller('admin')
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  users(@Query(new ZodValidationPipe(listUsersSchema)) q: ListUsersQuery) {
    return this.admin.users(q);
  }

  @Patch('users/:id')
  setActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(setActiveSchema)) body: { isActive: boolean },
    @CurrentUser() user: AuthUser,
  ) {
    return this.admin.setActive(id, body.isActive, user);
  }

  @Get('audit-logs')
  auditLogs(@Query(new ZodValidationPipe(listAuditSchema)) q: ListAuditQuery) {
    return this.admin.auditLogs(q);
  }

  @Get('audit-logs/facets')
  auditFacets() {
    return this.admin.auditFacets();
  }
}
