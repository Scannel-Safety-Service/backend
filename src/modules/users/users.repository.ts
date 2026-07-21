import { Injectable } from '@nestjs/common';
import { Prisma, User, Company } from '@prisma/client';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prismaService: TenantPrismaService) {}

  private get client() {
    return this.prismaService.client;
  }

  async findAndCount(
    where: Prisma.UserWhereInput,
    page: number = 1,
    limit: number = 10,
  ): Promise<[Omit<User, 'passwordHash'>[], number]> {
    const skip = (page - 1) * limit;
    const take = limit;

    const selectFields: Prisma.UserSelect = {
      id: true,
      email: true,
      userCode: true,
      name: true,
      role: true,
      isActive: true,
      archivedAt: true,
      companyId: true,
      createdAt: true,
      updatedAt: true,
      company: {
        select: {
          id: true,
          name: true,
        },
      },
    };

    const [items, total] = await (this.client.$transaction([
      this.client.user.findMany({
        where,
        select: selectFields,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.client.user.count({ where }),
    ]) as any);

    return [items as Omit<User, 'passwordHash'>[], total as number];
  }

  async findById(id: string): Promise<User | null> {
    return this.client.user.findUnique({
      where: { id },
    });
  }

  async findByIdWithCompany(id: string): Promise<(User & { company: Company | null }) | null> {
    return this.client.user.findUnique({
      where: { id },
      include: { company: true },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.client.user.findUnique({
      where: { email },
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.client.user.update({
      where: { id },
      data,
    });
  }
}

