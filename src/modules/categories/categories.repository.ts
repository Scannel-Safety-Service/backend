import { Injectable } from '@nestjs/common';
import { Prisma, Category } from '@prisma/client';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prismaService: TenantPrismaService) {}

  private get client() {
    return this.prismaService.client;
  }

  async findAndCount(
    where: Prisma.CategoryWhereInput,
    page: number = 1,
    limit: number = 10,
  ): Promise<[(Category & { assignments: { userId: string; user: { firstName: string; lastName: string } | null }[] })[], number]> {
    const skip = (page - 1) * limit;
    const take = limit;

    const [items, total] = await (this.client.$transaction([
      this.client.category.findMany({
        where,
        skip,
        take,
        include: {
          assignments: {
            select: {
              userId: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.client.category.count({ where }),
    ]) as any);

    return [items as any[], total as number];
  }

  async findById(
    id: string,
  ): Promise<(Category & { assignments: { userId: string; user: { firstName: string; lastName: string } | null }[] }) | null> {
    return this.client.category.findUnique({
      where: { id },
      include: {
        assignments: {
          select: {
            userId: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  async create(data: Prisma.CategoryCreateInput): Promise<Category> {
    return this.client.category.create({
      data,
    });
  }

  async update(
    id: string,
    data: Prisma.CategoryUpdateInput,
  ): Promise<Category> {
    return this.client.category.update({
      where: { id },
      data,
    });
  }
}

