import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Project, Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { Role } from '../../common/enums/role.enum';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { QueueService } from '../../shared/queue/queue.service';
import { StorageService } from '../../shared/storage/storage.service';
import { ProjectsRepository } from './projects.repository';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectQueryDto } from './dto/project-query.dto';
import { UploadProjectDocumentDto } from './dto/upload-project-document.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly repository: ProjectsRepository,
    private readonly prismaService: TenantPrismaService,
    private readonly queueService: QueueService,
    private readonly storageService: StorageService,
  ) {}

  async create(dto: CreateProjectDto, caller: AuthenticatedUser): Promise<Project> {
    let companyId: string;

    if (caller.role === Role.SUPER_ADMIN) {
      if (!dto.companyId) {
        throw new BadRequestException('Company ID is required for Super Admin');
      }
      companyId = dto.companyId;
      // Verify company exists
      const company = await this.prismaService.client.company.findUnique({
        where: { id: companyId },
      });
      if (!company) {
        throw new NotFoundException('Company not found');
      }
    } else {
      if (!caller.companyId) {
        throw new BadRequestException('Caller must belong to a company to create a project');
      }
      companyId = caller.companyId;
    }

    const data: Prisma.ProjectCreateInput = {
      name: dto.name,
      year: dto.year,
      company: { connect: { id: companyId } },
    };

    const project = await this.repository.create(data);

    // Trigger asynchronous off-thread background folder seeding
    await this.queueService.addJob('seed-project-folders', {
      projectId: project.id,
      companyId: project.companyId,
    });

    return project;
  }

  async findAll(queryDto: ProjectQueryDto, caller: AuthenticatedUser) {
    const where: Prisma.ProjectWhereInput = {};

    if (caller.role === Role.SUPER_ADMIN && queryDto.companyId) {
      where.companyId = queryDto.companyId;
    }

    if (queryDto.year !== undefined) {
      where.year = queryDto.year;
    }

    if (queryDto.archived === 'true') {
      where.archivedAt = { not: null };
    } else if (queryDto.archived === 'all') {
      // Return both active and archived
    } else {
      where.archivedAt = null;
    }

    const items = await this.repository.findMany(where);

    // Group projects by year (yearwise categorization)
    const grouped = items.reduce((acc, project) => {
      const yearStr = project.year.toString();
      if (!acc[yearStr]) {
        acc[yearStr] = [];
      }
      acc[yearStr].push(project);
      return acc;
    }, {} as Record<string, Project[]>);

    return {
      projectsByYear: grouped,
    };
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.repository.findById(id);
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async findFolders(id: string): Promise<any> {
    const project = await this.repository.findByIdWithFolders(id);
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async update(id: string, dto: UpdateProjectDto): Promise<Project> {
    await this.findOne(id); // Checks existence and tenant scoping boundaries

    const data: Prisma.ProjectUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.year !== undefined) data.year = dto.year;

    return this.repository.update(id, data);
  }

  async archive(id: string): Promise<Project> {
    const project = await this.findOne(id);
    if (project.archivedAt !== null) {
      throw new BadRequestException('Project is already archived');
    }
    return this.repository.update(id, { archivedAt: new Date() });
  }

  async restore(id: string): Promise<Project> {
    const project = await this.findOne(id);
    if (project.archivedAt === null) {
      throw new BadRequestException('Project is not archived');
    }
    return this.repository.update(id, { archivedAt: null });
  }

  async permanentDelete(id: string): Promise<void> {
    const project = await this.findOne(id);
    if (project.archivedAt === null) {
      throw new BadRequestException('Project must be archived first before permanent deletion');
    }
    await this.repository.delete(id);
  }

  async uploadDocument(
    projectId: string,
    folderId: string,
    dto: UploadProjectDocumentDto,
    file: Express.Multer.File,
    caller: AuthenticatedUser,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException('A file is required for upload');
    }

    // Verify project exists (scoping automatically applied by TenantPrismaService)
    const project = await this.findOne(projectId);

    // Verify folder exists and belongs to the project
    const folder = await this.prismaService.client.folder.findFirst({
      where: {
        id: folderId,
        projectId: project.id,
      },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    // Save the physical file
    const { fileUrl, originalFileName } = await this.storageService.saveFile(file);

    // Map folder name to DocumentSection enum where applicable, default to COMPANY_DOCUMENTS
    let section: any = 'COMPANY_DOCUMENTS';
    if (folder.name === 'Method Statements') {
      section = 'METHOD_STATEMENTS';
    }

    // Create the Document record
    const document = await this.prismaService.client.document.create({
      data: {
        title: dto.title || originalFileName,
        description: dto.description || null,
        section,
        fileUrl,
        originalFileName,
        company: { connect: { id: project.companyId } },
        project: { connect: { id: project.id } },
        folder: { connect: { id: folder.id } },
        user: caller.userId ? { connect: { id: caller.userId } } : undefined,
      },
    });

    return document;
  }
}
