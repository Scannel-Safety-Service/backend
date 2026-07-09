import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { Prisma, Document, DocumentSection } from '@prisma/client';
import { CreateDocumentDto } from './dto/create-document.dto';
import { AssignStandardDocumentDto } from './dto/assign-standard-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DocumentQueryDto, DocumentScope } from './dto/document-query.dto';
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

    if (
      dto.section === DocumentSection.COMPANY_DOCUMENTS ||
      dto.section === DocumentSection.RISK_ASSESSMENT
    ) {
      const categoryCount = await this.prismaService.client.category.count({
        where: {
          section: dto.section,
          isDeleted: false,
          archivedAt: null,
        },
      });

      if (categoryCount === 0) {
        throw new BadRequestException(
          `Cannot upload documents under ${
            dto.section === DocumentSection.COMPANY_DOCUMENTS
              ? 'Company Documents'
              : 'Risk Assessment'
          } because no active categories are defined. Please create a category first.`,
        );
      }

      if (!dto.categoryId) {
        throw new BadRequestException(
          `Category is required for ${
            dto.section === DocumentSection.COMPANY_DOCUMENTS
              ? 'Company Documents'
              : 'Risk Assessment'
          } documents.`,
        );
      }

      const category = await this.prismaService.client.category.findFirst({
        where: {
          id: dto.categoryId,
          section: dto.section,
          isDeleted: false,
          archivedAt: null,
        },
      });

      if (!category) {
        throw new BadRequestException(
          'The selected category is invalid or does not belong to this company and section.',
        );
      }
    } else if (dto.categoryId) {
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

    // ── Section filter ────────────────────────────────────────────────────────
    if (queryDto.section) {
      where.section = queryDto.section;
    }

    if (queryDto.categoryId) {
      where.categoryId = queryDto.categoryId;
    }

    if (queryDto.userId) {
      where.userId = queryDto.userId;
    }

    // ── Tenant / Role scoping ─────────────────────────────────────────────────
    // SUPER_ADMIN: can optionally scope to a specific company; otherwise sees all
    if (caller.role === Role.SUPER_ADMIN) {
      if (queryDto.companyId) {
        where.companyId = queryDto.companyId;
      }
    } else if (caller.role === Role.COMPANY_ADMIN) {
      // COMPANY_ADMIN is always scoped to their own company — no override allowed
      where.companyId = caller.companyId!;
    } else {
      // COMPANY_USER — can only see docs assigned to them or company-wide
      where.companyId = caller.companyId!;
      where.OR = [
        { userId: caller.userId },
        { userId: null, categoryId: null },
        {
          category: {
            OR: [
              { assignToAll: true },
              { assignments: { some: { userId: caller.userId } } },
            ],
          },
        },
      ];
    }

    // ── Archive filter ─────────────────────────────────────────────────────────
    if (queryDto.archived === 'true') {
      where.archivedAt = { not: null };
    } else if (queryDto.archived === 'all') {
      // no archivedAt constraint — include both active and archived
    } else {
      // default: active only
      where.archivedAt = null;
    }
    // Permanently soft-deleted records are NEVER visible via API
    where.isDeleted = false;

    // ── Document Scope / Isolation ───────────────────────────────────────────
    const scope = queryDto.scope || this.deriveDefaultScope(queryDto);

    switch (scope) {
      case DocumentScope.COMPANY:
        where.projectId = null;
        where.userId = null;
        where.assetId = null;
        break;
      case DocumentScope.PROJECT:
        if (queryDto.projectId) {
          where.projectId = queryDto.projectId;
        } else {
          where.projectId = { not: null };
        }
        break;
      case DocumentScope.INDIVIDUAL:
        if (queryDto.userId) {
          where.userId = queryDto.userId;
        } else if (queryDto.signatoryId) {
          where.userId = queryDto.signatoryId;
        } else {
          where.userId = { not: null };
        }
        where.projectId = null;
        break;
      case DocumentScope.ASSET:
        where.projectId = null;
        where.assetId = { not: null };
        break;
      case DocumentScope.GLOBAL:
      default:
        // Excludes project-scoped documents by default
        where.projectId = null;
        break;
    }

    if (queryDto.folderId) {
      where.folderId = queryDto.folderId;
    }

    // ── Interrogation Search filters ──────────────────────────────────────────

    // Date range filter on upload date (createdAt)
    // dateTo is treated as end-of-day (23:59:59 UTC) for inclusive single-day ranges
    if (queryDto.dateFrom || queryDto.dateTo) {
      const createdAtFilter: Prisma.DateTimeFilter = {};
      if (queryDto.dateFrom) {
        createdAtFilter.gte = new Date(queryDto.dateFrom);
      }
      if (queryDto.dateTo) {
        const toDate = new Date(queryDto.dateTo);
        toDate.setUTCHours(23, 59, 59, 999); // end of day inclusive
        createdAtFilter.lte = toDate;
      }
      where.createdAt = createdAtFilter;
    }

    // Signatory filter — the user who uploaded the document
    // Takes precedence over any generic userId filter above
    if (queryDto.signatoryId) {
      where.userId = queryDto.signatoryId;
    }

    // Document classification type (e.g. INSPECTION_REPORT, PERMIT, CERTIFICATE)
    if (queryDto.documentType) {
      where.documentType = queryDto.documentType;
    }

    // Inspection frequency type (e.g. DAILY, WEEKLY, MONTHLY, ANNUAL, ADHOC)
    if (queryDto.inspectionType) {
      where.inspectionType = queryDto.inspectionType;
    }

    // Full-text keyword search across title and originalFileName
    if (queryDto.keyword) {
      const keywordConditions: Prisma.DocumentWhereInput[] = [
        { title: { contains: queryDto.keyword, mode: 'insensitive' } },
        { originalFileName: { contains: queryDto.keyword, mode: 'insensitive' } },
      ];
      // Merge with any existing OR clause (e.g. role-based visibility for non-admins)
      if (where.OR) {
        where.AND = [
          { OR: where.OR as Prisma.DocumentWhereInput[] },
          { OR: keywordConditions },
        ];
        delete where.OR;
      } else {
        where.OR = keywordConditions;
      }
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


  /**
   * Returns only documents uploaded/assigned to a specific user (userId NOT NULL).
   * Used by the "Uploaded" tab in the company portal.
   * - originalFileName is excluded from the response at the DB select level.
   * - Uploader first/last name is included in each row.
   */
  async findAllUploaded(queryDto: DocumentQueryDto, caller: AuthenticatedUser) {
    const where: Prisma.DocumentWhereInput = {
      // Only user-scoped documents appear in the Uploaded view
      userId: { not: null },
    };

    // ── Tenant / Role scoping ─────────────────────────────────────────────────
    if (caller.role === Role.SUPER_ADMIN) {
      if (queryDto.companyId) {
        where.companyId = queryDto.companyId;
      }
    } else {
      where.companyId = caller.companyId!;
    }

    // Active only; permanently deleted records are never visible
    where.archivedAt = null;
    (where as any).deletedAt = null;

    const page = queryDto.page || 1;
    const limit = queryDto.limit || 100;

    const [items, total] = await this.documentsRepository.findAndCountUploaded(
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
    // Permanently soft-deleted records are invisible via API
    if (document.isDeleted) {
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

    const targetSection = dto.section !== undefined ? dto.section : document.section;
    if (
      targetSection === DocumentSection.COMPANY_DOCUMENTS ||
      targetSection === DocumentSection.RISK_ASSESSMENT
    ) {
      const categoryCount = await this.prismaService.client.category.count({
        where: {
          section: targetSection,
          isDeleted: false,
          archivedAt: null,
        },
      });

      if (categoryCount === 0) {
        throw new BadRequestException(
          `Cannot save document under ${
            targetSection === DocumentSection.COMPANY_DOCUMENTS
              ? 'Company Documents'
              : 'Risk Assessment'
          } because no active categories are defined. Please create a category first.`,
        );
      }

      const targetCategoryId = dto.categoryId !== undefined ? dto.categoryId : document.categoryId;
      if (!targetCategoryId) {
        throw new BadRequestException(
          `Category is required for ${
            targetSection === DocumentSection.COMPANY_DOCUMENTS
              ? 'Company Documents'
              : 'Risk Assessment'
          } documents.`,
        );
      }

      const category = await this.prismaService.client.category.findFirst({
        where: {
          id: targetCategoryId,
          section: targetSection,
          isDeleted: false,
          archivedAt: null,
        },
      });

      if (!category) {
        throw new BadRequestException(
          'The selected category is invalid or does not belong to this company and section.',
        );
      }
    } else if (dto.categoryId) {
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
    if (dto.section !== undefined) updateData.section = dto.section;
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

  /**
   * Soft permanent delete — sets isDeleted to true.
   * Record is permanently hidden from the UI but remains in the database forever.
   * Physical file is retained. Requires the document to be archived first.
   */
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
        'Document must be archived before permanent deletion',
      );
    }
    await this.documentsRepository.update(id, { isDeleted: true });
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

    // Validate category exists in the company/section if categoryId provided
    if (dto.categoryId) {
      const category = await this.prismaService.client.category.findUnique({ where: { id: dto.categoryId } });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    const data: Prisma.DocumentCreateInput = {
      title: dto.title || rawStdDoc.title,
      section: dto.section || 'SAFETY_STATEMENT',
      fileUrl: rawStdDoc.fileUrl,
      originalFileName: rawStdDoc.originalFileName || rawStdDoc.title,
      description: `Assigned from standard template: ${rawStdDoc.title}`,
      company: { connect: { id: companyId } },
      ...(dto.userId ? { user: { connect: { id: dto.userId } } } : {}),
      ...(dto.categoryId ? { category: { connect: { id: dto.categoryId } } } : {}),
    };

    return this.documentsRepository.create(data);
  }

  async getSecureFilePath(
    filename: string,
    caller: AuthenticatedUser,
  ): Promise<string> {
    // 1. Check if the file is a global template (StandardDocument)
    const stdDoc = await this.prismaService.client.standardDocument.findFirst({
      where: { fileUrl: `/uploads/${filename}` },
    });

    if (stdDoc) {
      const filePath = path.join(process.cwd(), 'uploads', filename);
      if (!fs.existsSync(filePath)) {
        throw new NotFoundException('Physical file not found');
      }
      return filePath;
    }

    // 2. Check if the file is a tenant-scoped document (Document)
    const document = await this.prismaService.client.document.findFirst({
      where: { fileUrl: `/uploads/${filename}` },
    });

    if (!document) {
      throw new NotFoundException('Document record not found');
    }

    // 3. Tenant scoping check
    if (
      caller.role !== Role.SUPER_ADMIN &&
      document.companyId !== caller.companyId
    ) {
      throw new NotFoundException('Document not found');
    }

    // 4. Role-based visibility check for non-admins
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

    const filePath = path.join(process.cwd(), 'uploads', filename);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Physical file not found');
    }

    return filePath;
  }

  private deriveDefaultScope(queryDto: DocumentQueryDto): DocumentScope {
    if (queryDto.projectId || queryDto.folderId) {
      return DocumentScope.PROJECT;
    }
    if (queryDto.userId || queryDto.signatoryId) {
      return DocumentScope.INDIVIDUAL;
    }
    return DocumentScope.GLOBAL;
  }
}
