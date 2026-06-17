import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Role } from '../../common/enums/role.enum';
import { hashToken } from '../../shared/utils/hash.util';
import { MailerService } from '../../shared/mailer/mailer.service';
import { AuthRepository } from './auth.repository';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailerService: MailerService,
  ) {}

  async register(
    dto: RegisterDto,
    creator: { userId: string; companyId: string | null; role: Role },
  ): Promise<Omit<User, 'passwordHash'>> {
    const existingUser = await this.authRepository.findUserByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    let companyId: string | null = null;

    if (creator.role === Role.SUPER_ADMIN) {
      if (dto.companyName) {
        const company = await this.authRepository.createCompany({ name: dto.companyName });
        companyId = company.id;
      } else if (dto.companyId) {
        companyId = dto.companyId;
      }
    } else if (creator.role === Role.COMPANY_ADMIN) {
      if (dto.role === Role.SUPER_ADMIN) {
        throw new ForbiddenException('Company Admin cannot create a Super Admin');
      }
      companyId = creator.companyId;
      if (!companyId) {
        throw new ForbiddenException('Creator must belong to a company to register users');
      }
    } else {
      throw new ForbiddenException('Only admins can register users');
    }

    let passwordHash: string;
    let isActive = true;

    if (dto.password) {
      passwordHash = await bcrypt.hash(dto.password, 12);
    } else {
      const randomPassword = randomBytes(32).toString('hex');
      passwordHash = await bcrypt.hash(randomPassword, 12);
      isActive = false;
    }

    try {
      const userCreateInput: any = {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        userCode: dto.userCode || null,
        isActive,
      };

      if (companyId) {
        userCreateInput.company = { connect: { id: companyId } };
      }

      const createdUser = await this.authRepository.createUser(userCreateInput);
      const { passwordHash: _, ...result } = createdUser;
      return result;
    } catch (error: any) {
      // Handle Prisma unique constraint error for companyId + userCode
      if (error.code === 'P2002') {
        throw new ConflictException('User code already exists within this company');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.authRepository.findUserByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive || user.archivedAt !== null) {
      throw new UnauthorizedException('Account is inactive or archived');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokenPair(user.id, user.companyId, user.role);

    const hashed = hashToken(tokens.refreshToken);
    const decoded = this.jwtService.decode(tokens.refreshToken) as { exp: number };
    const expiresAt = new Date(decoded.exp * 1000);

    await this.authRepository.createRefreshToken(user.id, hashed, expiresAt);

    return tokens;
  }

  async refresh(
    userId: string,
    companyId: string | null,
    role: Role,
    rawRefreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const hashed = hashToken(rawRefreshToken);
    const tokenRecord = await this.authRepository.findRefreshTokenByHash(hashed);

    if (!tokenRecord || tokenRecord.revokedAt !== null || tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.authRepository.revokeRefreshToken(hashed);

    const tokens = await this.issueTokenPair(userId, companyId, role);

    const newHashed = hashToken(tokens.refreshToken);
    const decoded = this.jwtService.decode(tokens.refreshToken) as { exp: number };
    const expiresAt = new Date(decoded.exp * 1000);

    await this.authRepository.createRefreshToken(userId, newHashed, expiresAt);

    return tokens;
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const hashed = hashToken(rawRefreshToken);
    await this.authRepository.revokeRefreshToken(hashed).catch(() => {
      // Idempotency: ignore if token already revoked or not found
    });
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.authRepository.findUserByEmail(dto.email);
    if (!user) {
      // Anti-enumeration: return success even if user not found
      return;
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await this.authRepository.createPasswordResetToken(user.id, tokenHash, expiresAt);
    await this.mailerService.sendPasswordResetEmail(user.email, token);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = hashToken(dto.token);
    const resetToken = await this.authRepository.findPasswordResetTokenByHash(tokenHash);

    if (!resetToken || resetToken.usedAt !== null || resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.authRepository.updateUserPassword(resetToken.userId, passwordHash);
    await this.authRepository.updatePasswordResetToken(resetToken.id, { usedAt: new Date() });
    await this.authRepository.revokeAllRefreshTokensForUser(resetToken.userId);
  }

  async generateInvitationToken(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.authRepository.createInvitationToken(userId, tokenHash, expiresAt);
    return token;
  }

  async acceptInvitation(dto: AcceptInvitationDto): Promise<void> {
    const tokenHash = hashToken(dto.token);
    const inviteToken = await this.authRepository.findInvitationTokenByHash(tokenHash);

    if (!inviteToken || inviteToken.usedAt !== null || inviteToken.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired invitation token');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    await Promise.all([
      this.authRepository.updateUser(inviteToken.userId, {
        passwordHash,
        isActive: true,
      }),
      this.authRepository.updateInvitationToken(inviteToken.id, { usedAt: new Date() }),
      this.authRepository.revokeAllRefreshTokensForUser(inviteToken.userId),
    ]);
  }

  async impersonate(
    targetUserId: string,
    adminId: string,
    ipAddress?: string,
  ): Promise<{ accessToken: string }> {
    const targetUser = await this.authRepository.findUserById(targetUserId);
    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    if (!targetUser.isActive || targetUser.archivedAt !== null) {
      throw new BadRequestException('Cannot impersonate inactive or archived user');
    }

    const admin = await this.authRepository.findUserById(adminId);
    if (!admin || admin.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admins can impersonate users');
    }

    const accessSecret = this.configService.get<string>('jwt.accessSecret');
    const accessPayload = {
      sub: targetUser.id,
      companyId: targetUser.companyId,
      role: targetUser.role,
      impersonatedBy: admin.id,
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: accessSecret,
      expiresIn: '20m', // 20 minutes impersonation token
    });

    await this.authRepository.createImpersonationLog(admin.id, targetUser.id, ipAddress);

    return { accessToken };
  }

  async stopImpersonation(adminId: string, targetUserId: string): Promise<void> {
    const log = await this.authRepository.findActiveImpersonationLog(adminId, targetUserId);
    if (!log) {
      throw new BadRequestException('No active impersonation session found');
    }

    await this.authRepository.updateImpersonationLog(log.id, { endedAt: new Date() });
  }

  private async issueTokenPair(
    userId: string,
    companyId: string | null,
    role: Role,
    impersonatedBy?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessSecret = this.configService.get<string>('jwt.accessSecret');
    const refreshSecret = this.configService.get<string>('jwt.refreshSecret');
    const accessExpiry = this.configService.get<string>('jwt.accessExpiry');
    const refreshExpiry = this.configService.get<string>('jwt.refreshExpiry');

    const accessPayload = {
      sub: userId,
      companyId,
      role,
      impersonatedBy,
    };

    const refreshPayload = {
      sub: userId,
      companyId,
      role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: accessSecret,
        expiresIn: accessExpiry as any,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: refreshSecret,
        expiresIn: refreshExpiry as any,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}
