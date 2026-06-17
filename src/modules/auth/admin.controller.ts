import { BadRequestException, Controller, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { AuthService } from './auth.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly authService: AuthService) {}

  @Post('users/:id/impersonate')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Impersonate a user (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Short-lived impersonation token issued successfully' })
  @ApiResponse({ status: 400, description: 'Cannot impersonate inactive/archived user' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async impersonate(
    @Param('id') targetUserId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: any,
  ) {
    // Nested impersonation check:
    if (admin.impersonatedBy) {
      throw new BadRequestException('Cannot nest impersonations');
    }

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || null;
    const result = await this.authService.impersonate(targetUserId, admin.userId, ipAddress);

    return {
      message: 'Impersonation session started successfully',
      data: result,
    };
  }

  @Post('impersonate/stop')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stop the active impersonation session' })
  @ApiResponse({ status: 200, description: 'Impersonation session stopped' })
  @ApiResponse({ status: 400, description: 'No active impersonation session found' })
  async stopImpersonation(@CurrentUser() user: AuthenticatedUser) {
    if (!user.impersonatedBy) {
      throw new BadRequestException('Not currently impersonating');
    }

    await this.authService.stopImpersonation(user.impersonatedBy, user.userId);

    return {
      message: 'Impersonation session stopped successfully',
      data: null,
    };
  }
}
