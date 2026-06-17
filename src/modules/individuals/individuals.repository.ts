import { Injectable } from '@nestjs/common';
import { Prisma, Individual } from '@prisma/client';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';

@Injectable()
export class IndividualsRepository {
  constructor(private readonly prismaService: TenantPrismaService) {}

  private get client() {
    return this.prismaService.client;
  }

  async findAndCount(
    where: Prisma.IndividualWhereInput,
    page: number = 1,
    limit: number = 10,
  ): Promise<[Individual[], number]> {
    const skip = (page - 1) * limit;
    const take = limit;

    const [items, total] = await (this.client.$transaction([
      this.client.individual.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.client.individual.count({ where }),
    ]) as any);

    return [items as Individual[], total as number];
  }

  async findById(id: string): Promise<Individual | null> {
    return this.client.individual.findUnique({
      where: { id },
    });
  }

  async create(data: Prisma.IndividualCreateInput): Promise<Individual> {
    return this.client.individual.create({
      data,
    });
  }

  async update(id: string, data: Prisma.IndividualUpdateInput): Promise<Individual> {
    return this.client.individual.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Individual> {
    return this.client.individual.delete({
      where: { id },
    });
  }
}
