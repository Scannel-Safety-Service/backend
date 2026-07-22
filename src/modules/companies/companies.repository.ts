import { Injectable } from '@nestjs/common';
import { Company, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CompaniesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.CompanyCreateInput): Promise<Company> {
    return this.prisma.company.create({ data });
  }

  async findAll(): Promise<any[]> {
    return this.prisma.company.findMany({
      where: { isDeleted: false, archivedAt: null },
      include: {
        users: {
          select: {
            id: true,
            role: true,
            isActive: true,
            isDeleted: true,
            archivedAt: true,
            email: true,
          },
        },
      },
    });
  }

  async findAndCount(
    page: number = 1,
    limit: number = 10,
    archived?: string,
  ): Promise<[any[], number]> {
    const skip = (page - 1) * limit;
    const take = limit;
    const where: Prisma.CompanyWhereInput = { isDeleted: false };

    if (archived === 'true') {
      where.archivedAt = { not: null };
    } else if (archived === 'false' || !archived) {
      where.archivedAt = null;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        where,
        skip,
        take,
        include: {
          users: {
            select: {
              id: true,
              role: true,
              isActive: true,
              archivedAt: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.company.count({ where }),
    ]);

    return [items, total];
  }

  async findById(id: string): Promise<any | null> {
    return this.prisma.company.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            role: true,
            isActive: true,
            isDeleted: true,
            archivedAt: true,
            email: true,
          },
        },
      },
    });
  }

  async update(id: string, data: Prisma.CompanyUpdateInput): Promise<Company> {
    return this.prisma.company.update({
      where: { id },
      data,
    });
  }

  async findUserByEmailExcludeId(email: string, excludeId: string): Promise<any | null> {
    return this.prisma.user.findFirst({
      where: {
        email,
        isDeleted: false,
        NOT: { id: excludeId },
      },
    });
  }

  async updateCompanyAndAdmin(
    companyId: string,
    companyData: Prisma.CompanyUpdateInput,
    adminUserId?: string,
    adminUserData?: Prisma.UserUpdateInput,
  ): Promise<Company> {
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.update({
        where: { id: companyId },
        data: companyData,
      });

      if (adminUserId && adminUserData) {
        await tx.user.update({
          where: { id: adminUserId },
          data: adminUserData,
        });
      }

      return company;
    });
  }

  async deleteCompany(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id },
        data: { isDeleted: true },
      });

      await tx.refreshToken.updateMany({
        where: {
          user: {
            companyId: id,
          },
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    });
  }

  async archiveCompany(id: string): Promise<Company> {
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.update({
        where: { id },
        data: { archivedAt: new Date() },
      });

      // Soft archive all non-deleted users belonging to this company
      await tx.user.updateMany({
        where: {
          companyId: id,
          archivedAt: null,
          isDeleted: false,
        },
        data: {
          archivedAt: new Date(),
        },
      });

      // Revoke all active refresh tokens for users in this company
      await tx.refreshToken.updateMany({
        where: {
          user: {
            companyId: id,
          },
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      return company;
    });
  }

  async restoreCompany(id: string): Promise<Company> {
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.update({
        where: { id },
        data: { archivedAt: null },
      });

      // Restore users belonging to this company
      await tx.user.updateMany({
        where: {
          companyId: id,
          isDeleted: false,
        },
        data: {
          archivedAt: null,
        },
      });

      return company;
    });
  }
}
