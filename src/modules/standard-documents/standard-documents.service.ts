import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StandardDocument } from '@prisma/client';
import { CreateStandardDocumentDto } from './dto/create-standard-document.dto';
import { UpdateStandardDocumentDto } from './dto/update-standard-document.dto';
import { StandardDocumentQueryDto } from './dto/standard-document-query.dto';
import { StandardDocumentsRepository } from './standard-documents.repository';
import { StorageService } from '../../shared/storage/storage.service';

@Injectable()
export class StandardDocumentsService {
  constructor(
    private readonly repository: StandardDocumentsRepository,
    private readonly storageService: StorageService,
  ) {}

  async create(
    dto: CreateStandardDocumentDto,
    file: Express.Multer.File,
  ): Promise<StandardDocument> {
    if (!file) {
      throw new BadRequestException('File upload is required');
    }

    const { fileUrl, originalFileName } =
      await this.storageService.saveFile(file);

    return this.repository.create({
      title: dto.title,
      description: dto.description,
      fileUrl,
      originalFileName,
    });
  }

  async findAll(queryDto: StandardDocumentQueryDto) {
    const where: Prisma.StandardDocumentWhereInput = {};

    if (queryDto.archived === 'true') {
      where.archivedAt = { not: null };
    } else if (queryDto.archived === 'false' || !queryDto.archived) {
      where.archivedAt = null;
    }
    // Permanently soft-deleted records are NEVER visible via API
    where.isDeleted = false;

    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;

    const [items, total] = await this.repository.findAndCount(
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

  async findOne(id: string): Promise<StandardDocument> {
    const doc = await this.repository.findById(id);
    if (!doc) {
      throw new NotFoundException('Standard document not found');
    }
    // Permanently soft-deleted records are invisible via API
    if (doc.isDeleted) {
      throw new NotFoundException('Standard document not found');
    }
    return doc;
  }

  async update(
    id: string,
    dto: UpdateStandardDocumentDto,
    file?: Express.Multer.File,
  ): Promise<StandardDocument> {
    const doc = await this.findOne(id);

    const updateData: Prisma.StandardDocumentUpdateInput = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;

    if (file) {
      const { fileUrl, originalFileName } =
        await this.storageService.saveFile(file);
      updateData.fileUrl = fileUrl;
      updateData.originalFileName = originalFileName;

      // Clean up old file
      await this.storageService.deleteFile(doc.fileUrl);
    }

    return this.repository.update(id, updateData);
  }

  async archive(id: string): Promise<StandardDocument> {
    const doc = await this.findOne(id);
    if (doc.archivedAt !== null) {
      throw new BadRequestException('Template is already archived');
    }

    return this.repository.update(id, {
      archivedAt: new Date(),
    });
  }

  async restore(id: string): Promise<StandardDocument> {
    const doc = await this.findOne(id);
    if (doc.archivedAt === null) {
      throw new BadRequestException('Template is not archived');
    }

    return this.repository.update(id, { archivedAt: null });
  }

  /**
   * Soft permanent delete — sets isDeleted to true.
   * Record is permanently hidden from the UI but remains in the database forever.
   * Physical file is retained. Requires the template to be archived first.
   */
  async permanentDelete(id: string): Promise<void> {
    const doc = await this.findOne(id);
    if (doc.archivedAt === null) {
      throw new BadRequestException(
        'Template must be archived before permanent deletion',
      );
    }
    await this.repository.update(id, { isDeleted: true });
  }
}
