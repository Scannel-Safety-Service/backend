import { Injectable } from '@nestjs/common';
import {
  Company,
  Prisma,
  RefreshToken,
  User,
  PasswordResetToken,
  InvitationToken,
  ImpersonationLog,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findCompanyByName(name: string): Promise<Company | null> {
    return this.prisma.company.findFirst({
      where: { name },
    });
  }

  async createCompany(data: Prisma.CompanyCreateInput): Promise<Company> {
    return this.prisma.company.create({ data });
  }

  async createUser(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async createUserWithCompany(
    companyName: string,
    userData: Omit<Prisma.UserCreateInput, 'company'>,
  ): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: { name: companyName },
      });
      return tx.user.create({
        data: {
          ...userData,
          company: { connect: { id: company.id } },
        },
      });
    });
  }

  async createRefreshToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId,
        expiresAt,
      },
    });
  }

  async findRefreshTokenByHash(
    tokenHash: string,
  ): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
  }

  async revokeRefreshToken(
    tokenHash: string,
    revokedAt: Date = new Date(),
  ): Promise<RefreshToken> {
    return this.prisma.refreshToken.update({
      where: { tokenHash },
      data: { revokedAt },
    });
  }

  async revokeAllRefreshTokensForUser(
    userId: string,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async createPasswordResetToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  async findPasswordResetTokenByHash(
    tokenHash: string,
  ): Promise<PasswordResetToken | null> {
    return this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
  }

  async updatePasswordResetToken(
    id: string,
    data: Prisma.PasswordResetTokenUpdateInput,
  ): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.update({
      where: { id },
      data,
    });
  }

  async updateUserPassword(
    userId: string,
    passwordHash: string,
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async updateUser(
    userId: string,
    data: Prisma.UserUpdateInput,
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  async createInvitationToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<InvitationToken> {
    return this.prisma.invitationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  async findInvitationTokenByHash(
    tokenHash: string,
  ): Promise<InvitationToken | null> {
    return this.prisma.invitationToken.findUnique({
      where: { tokenHash },
    });
  }

  async updateInvitationToken(
    id: string,
    data: Prisma.InvitationTokenUpdateInput,
  ): Promise<InvitationToken> {
    return this.prisma.invitationToken.update({
      where: { id },
      data,
    });
  }

  async createImpersonationLog(
    adminId: string,
    targetUserId: string,
    ipAddress?: string,
  ): Promise<ImpersonationLog> {
    return this.prisma.impersonationLog.create({
      data: {
        adminId,
        targetUserId,
        ipAddress,
      },
    });
  }

  async findActiveImpersonationLog(
    adminId: string,
    targetUserId: string,
  ): Promise<ImpersonationLog | null> {
    return this.prisma.impersonationLog.findFirst({
      where: {
        adminId,
        targetUserId,
        endedAt: null,
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async updateImpersonationLog(
    id: string,
    data: Prisma.ImpersonationLogUpdateInput,
  ): Promise<ImpersonationLog> {
    return this.prisma.impersonationLog.update({
      where: { id },
      data,
    });
  }
}
