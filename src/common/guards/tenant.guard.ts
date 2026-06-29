import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '../enums/role.enum';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If route is public or unauthenticated, skip tenant guard check (let JwtAuthGuard handle it if needed)
    if (!user) {
      return true;
    }

    // SUPER_ADMIN bypasses all tenant scoping checks
    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }

    const params = request.params;
    const path = request.route?.path || '';

    // 1. Enforce match if route has explicit :companyId parameter
    if (params.companyId && params.companyId !== user.companyId) {
      // Return 404 to satisfy the anti-enumeration requirement (mask resource existence)
      throw new NotFoundException('Resource not found');
    }

    // 2. Enforce match on company resources (e.g. /companies/:id)
    if (
      path.includes('/companies/:id') &&
      params.id &&
      params.id !== user.companyId
    ) {
      throw new NotFoundException('Resource not found');
    }

    return true;
  }
}
