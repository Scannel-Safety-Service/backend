import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
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
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      archivedAt: true,
      companyId: true,
      createdAt: true,
      updatedAt: true,
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

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.client.user.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<User> {
    return this.client.user.delete({
      where: { id },
    });
  }
}
