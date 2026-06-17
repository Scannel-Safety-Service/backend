import { Injectable } from '@nestjs/common';
import { Company, Prisma, RefreshToken, User } from '@prisma/client';
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
        } as Prisma.UserCreateInput,
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

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
  }

  async revokeRefreshToken(tokenHash: string, revokedAt: Date = new Date()): Promise<RefreshToken> {
    return this.prisma.refreshToken.update({
      where: { tokenHash },
      data: { revokedAt },
    });
  }

  async revokeAllRefreshTokensForUser(userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
