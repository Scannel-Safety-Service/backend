import { Injectable } from '@nestjs/common';
import { Prisma, Document } from '@prisma/client';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';

// ── Enriched Document type returned by findAndCount ───────────────────────────
// Includes joined relations needed for interrogation search result display
export type EnrichedDocument = Document & {
  project: { id: string; name: string; year: number } | null;
  folder: { id: string; name: string } | null;
  user: { id: string; firstName: string; lastName: string } | null;
  category: { id: string; name: string } | null;
};

// Prisma include shape reused for all enriched queries
const DOCUMENT_INCLUDE = {
  project: {
    select: { id: true, name: true, year: true },
  },
  folder: {
    select: { id: true, name: true },
  },
  user: {
    select: { id: true, firstName: true, lastName: true },
  },
  category: {
    select: { id: true, name: true },
  },
} satisfies Prisma.DocumentInclude;

@Injectable()
export class DocumentsRepository {
  constructor(private readonly prismaService: TenantPrismaService) {}

  private get client() {
    return this.prismaService.client;
  }

  /**
   * Paginated find with enriched relation joins.
   * Returns [items, total] where items include project, folder, and uploader info.
   */
  async findAndCount(
    where: Prisma.DocumentWhereInput,
    page: number = 1,
    limit: number = 10,
  ): Promise<[EnrichedDocument[], number]> {
    const skip = (page - 1) * limit;
    const take = limit;

    const [items, total] = await (this.client.$transaction([
      this.client.document.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: DOCUMENT_INCLUDE,
      }),
      this.client.document.count({ where }),
    ]) as any);

    return [items as EnrichedDocument[], total as number];
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
