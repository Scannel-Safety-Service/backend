import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Document } from '@prisma/client';
import { CreateDocumentDto } from './dto/create-document.dto';
import { AssignStandardDocumentDto } from './dto/assign-standard-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DocumentQueryDto } from './dto/document-query.dto';
import { DocumentsRepository } from './documents.repository';
import { StorageService } from '../../shared/storage/storage.service';
import { CategoriesService } from '../categories/categories.service';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly documentsRepository: DocumentsRepository,
    private readonly storageService: StorageService,
    private readonly categoriesService: CategoriesService,
    private readonly prismaService: TenantPrismaService,
  ) {}

  async create(
    dto: CreateDocumentDto,
    file: Express.Multer.File,
    caller: AuthenticatedUser,
  ): Promise<Document> {
    if (!file) {
      throw new BadRequestException('File upload is required');
    }

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
        throw new BadRequestException(
          'Caller must belong to a company to upload documents',
        );
      }
      companyId = caller.companyId;
    }

    if (dto.categoryId) {
      await this.categoriesService.findOne(dto.categoryId);
    }

    if (dto.userId) {
      const user = await this.prismaService.client.user.findUnique({
        where: { id: dto.userId },
      });
      if (!user || user.companyId !== companyId) {
        throw new NotFoundException('Scoped user not found in this company');
      }
    }

    const { fileUrl, originalFileName } =
      await this.storageService.saveFile(file);

    const title = dto.title || file.originalname;

    const data: Prisma.DocumentCreateInput = {
      title,
      description: dto.description || null,
      section: dto.section,
      fileUrl,
      originalFileName,
      company: { connect: { id: companyId } },
    };

    if (dto.categoryId) {
      data.category = { connect: { id: dto.categoryId } };
    }

    if (dto.userId) {
      data.user = { connect: { id: dto.userId } };
    }

    return this.documentsRepository.create(data);
  }

  async findAll(queryDto: DocumentQueryDto, caller: AuthenticatedUser) {
    const where: Prisma.DocumentWhereInput = {};

    if (queryDto.section) {
      where.section = queryDto.section;
    }

    if (queryDto.categoryId) {
      where.categoryId = queryDto.categoryId;
    }

    if (queryDto.userId) {
      where.userId = queryDto.userId;
    }

    // Apply security check for non-admin callers (COMPANY_USER, APP_USER)
    if (
      caller.role !== Role.SUPER_ADMIN &&
      caller.role !== Role.COMPANY_ADMIN
    ) {
      where.OR = [
        { userId: caller.userId },
        {
          userId: null,
          categoryId: null,
        },
        {
          category: {
            OR: [
              { assignToAll: true },
              {
                assignments: {
                  some: {
                    userId: caller.userId,
                  },
                },
              },
            ],
          },
        },
      ];
    } else if (caller.role === Role.SUPER_ADMIN && queryDto.companyId) {
      where.companyId = queryDto.companyId;
    }

    if (queryDto.archived === 'true') {
      where.archivedAt = { not: null };
    } else if (queryDto.archived === 'false' || !queryDto.archived) {
      where.archivedAt = null;
    }

    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;

    const [items, total] = await this.documentsRepository.findAndCount(
      where,
      page,
      limit,
    );

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, caller: AuthenticatedUser): Promise<Document> {
    const document = await this.documentsRepository.findById(id);
    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Tenant check
    if (
      caller.role !== Role.SUPER_ADMIN &&
      document.companyId !== caller.companyId
    ) {
      throw new NotFoundException('Document not found');
    }

    // Role-based visibility check for non-admins
    if (
      caller.role !== Role.SUPER_ADMIN &&
      caller.role !== Role.COMPANY_ADMIN
    ) {
      const isAssignedToUser = document.userId === caller.userId;
      const isCompanyWide =
        document.userId === null && document.categoryId === null;

      let isCategoryAssigned = false;
      if (document.categoryId) {
        const count = await this.prismaService.client.category.count({
          where: {
            id: document.categoryId,
            OR: [
              { assignToAll: true },
              {
                assignments: {
                  some: {
                    userId: caller.userId,
                  },
                },
              },
            ],
          },
        });
        isCategoryAssigned = count > 0;
      }

      if (!isAssignedToUser && !isCompanyWide && !isCategoryAssigned) {
        throw new NotFoundException('Document not found');
      }
    }

    return document;
  }

  async update(
    id: string,
    dto: UpdateDocumentDto,
    caller: AuthenticatedUser,
    file?: Express.Multer.File,
  ): Promise<Document> {
    const document = await this.findOne(id, caller);

    if (
      caller.role !== Role.SUPER_ADMIN &&
      caller.role !== Role.COMPANY_ADMIN
    ) {
      throw new NotFoundException('Document not found');
    }

    const companyId = document.companyId;

    if (dto.categoryId) {
      await this.categoriesService.findOne(dto.categoryId);
    }

    if (dto.userId) {
      const user = await this.prismaService.client.user.findUnique({
        where: { id: dto.userId },
      });
      if (!user || user.companyId !== companyId) {
        throw new NotFoundException('Scoped user not found in this company');
      }
    }

    const updateData: Prisma.DocumentUpdateInput = {};

    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;

    if (dto.isReviewed !== undefined) {
      updateData.isReviewed = dto.isReviewed;
      updateData.reviewedAt = dto.isReviewed ? new Date() : null;
    }

    if (dto.categoryId !== undefined) {
      if (dto.categoryId === null) {
        updateData.category = { disconnect: true };
      } else {
        updateData.category = { connect: { id: dto.categoryId } };
      }
    }

    if (dto.userId !== undefined) {
      if (dto.userId === null) {
        updateData.user = { disconnect: true };
      } else {
        updateData.user = { connect: { id: dto.userId } };
      }
    }

    if (file) {
      const { fileUrl, originalFileName } =
        await this.storageService.saveFile(file);
      updateData.fileUrl = fileUrl;
      updateData.originalFileName = originalFileName;

      await this.storageService.deleteFile(document.fileUrl);
    }

    return this.documentsRepository.update(id, updateData);
  }

  async archive(id: string, caller: AuthenticatedUser): Promise<Document> {
    const document = await this.findOne(id, caller);
    if (
      caller.role !== Role.SUPER_ADMIN &&
      caller.role !== Role.COMPANY_ADMIN
    ) {
      throw new NotFoundException('Document not found');
    }

    if (document.archivedAt !== null) {
      throw new BadRequestException('Document is already archived');
    }

    return this.documentsRepository.update(id, {
      archivedAt: new Date(),
    });
  }

  async restore(id: string, caller: AuthenticatedUser): Promise<Document> {
    const document = await this.findOne(id, caller);
    if (
      caller.role !== Role.SUPER_ADMIN &&
      caller.role !== Role.COMPANY_ADMIN
    ) {
      throw new NotFoundException('Document not found');
    }

    if (document.archivedAt === null) {
      throw new BadRequestException('Document is not archived');
    }

    return this.documentsRepository.update(id, {
      archivedAt: null,
    });
  }

  async permanentDelete(id: string, caller: AuthenticatedUser): Promise<void> {
    const document = await this.findOne(id, caller);
    if (
      caller.role !== Role.SUPER_ADMIN &&
      caller.role !== Role.COMPANY_ADMIN
    ) {
      throw new NotFoundException('Document not found');
    }

    if (document.archivedAt === null) {
      throw new BadRequestException(
        'Document must be archived first before permanent deletion',
      );
    }

    await this.storageService.deleteFile(document.fileUrl);
    await this.documentsRepository.delete(id);
  }

  async directDelete(id: string, caller: AuthenticatedUser): Promise<void> {
    const document = await this.findOne(id, caller);
    if (caller.role !== Role.SUPER_ADMIN && caller.role !== Role.COMPANY_ADMIN) {
      throw new NotFoundException('Document not found');
    }

    await this.storageService.deleteFile(document.fileUrl);
    await this.documentsRepository.delete(id);
  }

  /**
   * Assign a global standard document template to a specific user/company.
   * Instead of re-uploading the file, we create a Document record that
   * references the same fileUrl as the StandardDocument.
   */
  async createFromStandard(dto: AssignStandardDocumentDto, caller: AuthenticatedUser): Promise<Document> {
    // Resolve the companyId
    let companyId: string;
    if (caller.role === Role.SUPER_ADMIN) {
      if (!dto.companyId) throw new BadRequestException('Company ID is required for Super Admin');
      companyId = dto.companyId;
    } else {
      if (!caller.companyId) throw new BadRequestException('Caller must belong to a company');
      companyId = caller.companyId;
    }

    // Verify company exists in the tenant DB
    const company = await this.prismaService.client.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    // Fetch the standard document from the shared Prisma client
    const rawStdDoc = await (this.prismaService.client as any).standardDocument?.findUnique({
      where: { id: dto.standardDocumentId },
    });

    if (!rawStdDoc) {
      throw new NotFoundException('Standard document template not found');
    }

    // Validate user belongs to company if userId provided
    if (dto.userId) {
      const user = await this.prismaService.client.user.findUnique({ where: { id: dto.userId } });
      if (!user || user.companyId !== companyId) {
        throw new NotFoundException('User not found in this company');
      }
    }

    const data: Prisma.DocumentCreateInput = {
      title: dto.title || rawStdDoc.title,
      section: dto.section || rawStdDoc.section,
      fileUrl: rawStdDoc.fileUrl,
      originalFileName: rawStdDoc.originalFileName || rawStdDoc.title,
      description: `Assigned from standard template: ${rawStdDoc.title}`,
      company: { connect: { id: companyId } },
      ...(dto.userId ? { user: { connect: { id: dto.userId } } } : {}),
    };

    return this.documentsRepository.create(data);
  }
}
