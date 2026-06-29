import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and obtain access/refresh token pair' })
  @ApiResponse({ status: 200, description: 'Tokens issued successfully' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto) {
    const tokens = await this.authService.login(dto);
    return {
      message: 'Login successful',
      data: tokens,
    };
  }

  @Post('register')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a new user (Admin-only)' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  async register(
    @Body() dto: RegisterDto,
    @CurrentUser() creator: AuthenticatedUser,
  ) {
    const user = await this.authService.register(dto, creator);
    return {
      message: 'User registered successfully',
      data: user,
    };
  }

  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access/refresh tokens' })
  @ApiResponse({ status: 200, description: 'Tokens rotated successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Req() req: any) {
    const { userId, companyId, role, refreshToken } = req.user;
    const tokens = await this.authService.refresh(
      userId,
      companyId,
      role,
      refreshToken,
    );
    return {
      message: 'Tokens rotated successfully',
      data: tokens,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(@Body() dto: LogoutDto) {
    await this.authService.logout(dto.refreshToken);
    return {
      message: 'Logout successful',
      data: null,
    };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a password reset email (Anti-enumeration)',
  })
  @ApiResponse({
    status: 200,
    description: 'If the email exists, a reset link will be sent',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto);
    return {
      message: 'If the email exists, a password reset link has been sent.',
      data: null,
    };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return {
      message: 'Password reset successful.',
      data: null,
    };
  }

  @Public()
  @Post('accept-invitation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept account invitation and set password' })
  @ApiResponse({
    status: 200,
    description: 'Invitation accepted and password set',
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async acceptInvitation(@Body() dto: AcceptInvitationDto) {
    await this.authService.acceptInvitation(dto);
    return {
      message: 'Invitation accepted successfully.',
      data: null,
    };
  }
}
