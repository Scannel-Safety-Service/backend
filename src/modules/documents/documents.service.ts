import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Document } from '@prisma/client';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DocumentQueryDto } from './dto/document-query.dto';
import { DocumentsRepository } from './documents.repository';
import { StorageService } from '../../shared/storage/storage.service';
import { CategoriesService } from '../categories/categories.service';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly documentsRepository: DocumentsRepository,
    private readonly storageService: StorageService,
    private readonly categoriesService: CategoriesService,
    private readonly prismaService: TenantPrismaService,
  ) {}

  async create(dto: CreateDocumentDto, file: Express.Multer.File): Promise<Document> {
    if (!file) {
      throw new BadRequestException('File upload is required');
    }

    if (dto.categoryId) {
      await this.categoriesService.findOne(dto.categoryId);
    }

    if (dto.userId) {
      await this.verifyUserBelongsToTenant(dto.userId);
    }

    const { fileUrl, originalFileName } = await this.storageService.saveFile(file);

    const data: Prisma.DocumentCreateInput = {
      section: dto.section,
      fileUrl,
      originalFileName,
      company: { connect: { id: '' } }, // Injected by TenantPrismaService query hook
    };

    if (dto.categoryId) {
      data.category = { connect: { id: dto.categoryId } };
    }

    if (dto.userId) {
      data.user = { connect: { id: dto.userId } };
    }

    return this.documentsRepository.create(data);
  }

  async findAll(queryDto: DocumentQueryDto) {
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

    if (queryDto.archived === 'true') {
      where.archivedAt = { not: null };
    } else if (queryDto.archived === 'false' || !queryDto.archived) {
      where.archivedAt = null;
    }

    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;

    const [items, total] = await this.documentsRepository.findAndCount(where, page, limit);

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

  async findOne(id: string): Promise<Document> {
    const document = await this.documentsRepository.findById(id);
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    return document;
  }

  async update(id: string, dto: UpdateDocumentDto, file?: Express.Multer.File): Promise<Document> {
    const document = await this.findOne(id);

    if (dto.categoryId) {
      await this.categoriesService.findOne(dto.categoryId);
    }

    if (dto.userId) {
      await this.verifyUserBelongsToTenant(dto.userId);
    }

    const updateData: Prisma.DocumentUpdateInput = {};

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
      // Overwrite / replace file reference
      const { fileUrl, originalFileName } = await this.storageService.saveFile(file);
      updateData.fileUrl = fileUrl;
      updateData.originalFileName = originalFileName;

      // Clean up old file asynchronously
      await this.storageService.deleteFile(document.fileUrl);
    }

    return this.documentsRepository.update(id, updateData);
  }

  async archive(id: string): Promise<Document> {
    const document = await this.findOne(id);
    if (document.archivedAt !== null) {
      throw new BadRequestException('Document is already archived');
    }

    return this.documentsRepository.update(id, {
      archivedAt: new Date(),
    });
  }

  async restore(id: string): Promise<Document> {
    const document = await this.findOne(id);
    if (document.archivedAt === null) {
      throw new BadRequestException('Document is not archived');
    }

    return this.documentsRepository.update(id, {
      archivedAt: null,
    });
  }

  async permanentDelete(id: string): Promise<void> {
    const document = await this.findOne(id);
    if (document.archivedAt === null) {
      throw new BadRequestException('Document must be archived first before permanent deletion');
    }

    // Physically delete the file
    await this.storageService.deleteFile(document.fileUrl);

    // Delete record from database
    await this.documentsRepository.delete(id);
  }

  private async verifyUserBelongsToTenant(userId: string): Promise<void> {
    const user = await this.prismaService.client.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('Scoped user not found');
    }
  }
}
