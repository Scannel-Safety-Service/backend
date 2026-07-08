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
      include: {
        users: {
          select: {
            id: true,
            role: true,
            isActive: true,
            archivedAt: true,
          },
        },
      },
    });
  }

  async findAndCount(
    page: number = 1,
    limit: number = 10,
    isActive?: boolean,
  ): Promise<[any[], number]> {
    const skip = (page - 1) * limit;
    const take = limit;
    const where: Prisma.CompanyWhereInput = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
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
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.company.count({ where }),
    ]);

    return [items, total];
  }

  async findById(id: string): Promise<Company | null> {
    return this.prisma.company.findUnique({
      where: { id },
    });
  }

  async update(id: string, data: Prisma.CompanyUpdateInput): Promise<Company> {
    return this.prisma.company.update({
      where: { id },
      data,
    });
  }
}
