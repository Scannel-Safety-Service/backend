import { Injectable } from '@nestjs/common';
import { Prisma, Document } from '@prisma/client';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';

@Injectable()
export class DocumentsRepository {
  constructor(private readonly prismaService: TenantPrismaService) {}

  private get client() {
    return this.prismaService.client;
  }

  async findAndCount(
    where: Prisma.DocumentWhereInput,
    page: number = 1,
    limit: number = 10,
  ): Promise<[Document[], number]> {
    const skip = (page - 1) * limit;
    const take = limit;

    const [items, total] = await (this.client.$transaction([
      this.client.document.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.client.document.count({ where }),
    ]) as any);

    return [items as Document[], total as number];
  }

  async findById(id: string): Promise<Document | null> {
    return this.client.document.findUnique({
      where: { id },
    });
  }

  async create(data: Prisma.DocumentCreateInput): Promise<Document> {
    return this.client.document.create({
      data,
    });
  }

  async update(
    id: string,
    data: Prisma.DocumentUpdateInput,
  ): Promise<Document> {
    return this.client.document.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Document> {
    return this.client.document.delete({
      where: { id },
    });
  }
}
