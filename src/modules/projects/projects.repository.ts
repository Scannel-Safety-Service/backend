import { Injectable } from '@nestjs/common';
import { Project, Folder, Prisma } from '@prisma/client';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';

@Injectable()
export class ProjectsRepository {
  constructor(private readonly prismaService: TenantPrismaService) {}

  private get client() {
    return this.prismaService.client;
  }

  async create(data: Prisma.ProjectCreateInput): Promise<Project> {
    return this.client.project.create({ data });
  }

  async findMany(where: Prisma.ProjectWhereInput): Promise<Project[]> {
    return this.client.project.findMany({
      where,
      orderBy: [{ year: 'desc' }, { name: 'asc' }],
    });
  }

  async findById(id: string): Promise<Project | null> {
    return this.client.project.findUnique({
      where: { id },
    });
  }

  async findByIdWithFolders(
    id: string,
  ): Promise<
    (Project & { folders: (Folder & { documents: any[] })[] }) | null
  > {
    return this.client.project.findUnique({
      where: { id },
      include: {
        folders: {
          orderBy: { name: 'asc' },
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
        },
      },
    });
  }

  async update(id: string, data: Prisma.ProjectUpdateInput): Promise<Project> {
    return this.client.project.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Project> {
    return this.client.project.delete({
      where: { id },
    });
  }
}
