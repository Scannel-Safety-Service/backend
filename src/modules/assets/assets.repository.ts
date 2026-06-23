import { Injectable } from '@nestjs/common';
import { Asset, Prisma } from '@prisma/client';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';

@Injectable()
export class AssetsRepository {
  constructor(private readonly prismaService: TenantPrismaService) {}

  private get client() {
    return this.prismaService.client;
  }

  async create(data: Prisma.AssetCreateInput): Promise<Asset> {
    return this.client.asset.create({ data });
  }

  async findAndCount(
    where: Prisma.AssetWhereInput,
    page: number = 1,
    limit: number = 10,
  ): Promise<[Asset[], number]> {
    const skip = (page - 1) * limit;

    const [items, total] = await (this.client.$transaction([
      this.client.asset.findMany({
        where,
        skip,
        take: limit,
        orderBy: { expiryDate: 'asc' }, // Closest-to-expiry shown first
        include: {
          // Return summary counts only — full document list via GET /assets/:id
          _count: { select: { documents: true } },
        },
      }),
      this.client.asset.count({ where }),
    ]) as any);

    return [items as Asset[], total as number];
  }

  async findById(id: string): Promise<(Asset & { documents: any[] }) | null> {
    return this.client.asset.findUnique({
      where: { id },
      include: {
        documents: {
          where: { archivedAt: null },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            originalFileName: true,
            fileUrl: true,
            section: true,
            isReviewed: true,
            reviewedAt: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async update(id: string, data: Prisma.AssetUpdateInput): Promise<Asset> {
    return this.client.asset.update({ where: { id }, data });
  }

  async delete(id: string): Promise<Asset> {
    return this.client.asset.delete({ where: { id } });
  }
}
