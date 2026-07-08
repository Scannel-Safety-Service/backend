import { Injectable } from '@nestjs/common';
import { Prisma, StandardDocument } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StandardDocumentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAndCount(
    where: Prisma.StandardDocumentWhereInput,
    page: number = 1,
    limit: number = 10,
  ): Promise<[StandardDocument[], number]> {
    const skip = (page - 1) * limit;
    const take = limit;

    const [items, total] = await (this.prisma.$transaction([
      this.prisma.standardDocument.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.standardDocument.count({ where }),
    ]) as any);

    return [items as StandardDocument[], total as number];
  }

  async findById(id: string): Promise<StandardDocument | null> {
    return this.prisma.standardDocument.findUnique({
      where: { id },
    });
  }

  async create(
    data: Prisma.StandardDocumentCreateInput,
  ): Promise<StandardDocument> {
    return this.prisma.standardDocument.create({
      data,
    });
  }

  async update(
    id: string,
    data: Prisma.StandardDocumentUpdateInput,
  ): Promise<StandardDocument> {
    return this.prisma.standardDocument.update({
      where: { id },
      data,
    });
  }
}

