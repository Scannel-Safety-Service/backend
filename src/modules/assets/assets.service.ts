import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Asset, Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { Role } from '../../common/enums/role.enum';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { StorageService } from '../../shared/storage/storage.service';
import { AssetsRepository } from './assets.repository';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { AssetExpiryStatus, AssetQueryDto } from './dto/asset-query.dto';

/**
 * Default amber threshold in days.
 *
 * Module 2 will make this configurable per company by reading
 * a `amberThresholdDays` field from the Company record.
 * Until then, 30 days is the system-wide default.
 */
const DEFAULT_AMBER_THRESHOLD_DAYS = 30;

@Injectable()
export class AssetsService {
  private readonly logger = new Logger(AssetsService.name);

  constructor(
    private readonly repository: AssetsRepository,
    private readonly prismaService: TenantPrismaService,
    private readonly storageService: StorageService,
  ) { }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async create(dto: CreateAssetDto): Promise<Asset> {
    const data: Prisma.AssetCreateInput = {
      name: dto.name,
      serialNumber: dto.serialNumber,
      category: dto.category,
      description: dto.description,
      expiryDate: new Date(dto.expiryDate),
      company: { connect: { id: '' } }, // companyId auto-injected by TenantPrismaService
    };

    return this.repository.create(data);
  }

  async findAll(queryDto: AssetQueryDto, caller: AuthenticatedUser) {
    const where: Prisma.AssetWhereInput = {};

    // SUPER_ADMIN may optionally scope to a specific company
    if (caller.role === Role.SUPER_ADMIN && queryDto.companyId) {
      where.companyId = queryDto.companyId;
    }

    // Category filter
    if (queryDto.category) {
      where.category = queryDto.category;
    }

    // Archived state (default: active only)
    if (queryDto.archived === 'true') {
      where.archivedAt = { not: null };
    } else if (queryDto.archived === 'all') {
      // no archivedAt filter — return everything
    } else {
      where.archivedAt = null;
    }

    // Explicit date-range filter (for external queries, e.g. report exports)
    if (queryDto.expiryFrom || queryDto.expiryTo) {
      where.expiryDate = {};
      if (queryDto.expiryFrom)
        where.expiryDate.gte = new Date(queryDto.expiryFrom);
      if (queryDto.expiryTo) where.expiryDate.lte = new Date(queryDto.expiryTo);
    }

    // Expiry status — semantic traffic-light filter
    // NOTE: In Module 2, amberThresholdDays will come from CompanySettings.
    if (queryDto.expiryStatus) {
      const now = new Date();
      const amberCutoff = new Date(now);
      amberCutoff.setDate(amberCutoff.getDate() + DEFAULT_AMBER_THRESHOLD_DAYS);

      switch (queryDto.expiryStatus) {
        case AssetExpiryStatus.EXPIRED:
          where.expiryDate = { lt: now };
          break;
        case AssetExpiryStatus.EXPIRING:
          where.expiryDate = { gte: now, lte: amberCutoff };
          break;
        case AssetExpiryStatus.VALID:
          where.expiryDate = { gt: amberCutoff };
          break;
      }
    }

    const page = queryDto.page ?? 1;
    const limit = queryDto.limit ?? 10;

    const [items, total] = await this.repository.findAndCount(
      where,
      page,
      limit,
    );

    // Annotate each asset with its computed traffic-light status
    // This is consumed directly by dashboards — Module 2 will centralise this
    const now = new Date();
    const amberCutoff = new Date(now);
    amberCutoff.setDate(amberCutoff.getDate() + DEFAULT_AMBER_THRESHOLD_DAYS);

    const annotatedItems = items.map((asset: any) => ({
      ...asset,
      expiryStatus: this.computeExpiryStatus(
        new Date(asset.expiryDate),
        now,
        amberCutoff,
      ),
    }));

    return {
      items: annotatedItems,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<any> {
    const asset = await this.repository.findById(id);
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    const now = new Date();
    const amberCutoff = new Date(now);
    amberCutoff.setDate(amberCutoff.getDate() + DEFAULT_AMBER_THRESHOLD_DAYS);

    return {
      ...asset,
      expiryStatus: this.computeExpiryStatus(
        new Date(asset.expiryDate),
        now,
        amberCutoff,
      ),
    };
  }

  async update(id: string, dto: UpdateAssetDto): Promise<Asset> {
    await this.findOne(id); // Existence + tenant check via scoped findUnique

    const data: Prisma.AssetUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.serialNumber !== undefined) data.serialNumber = dto.serialNumber;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.expiryDate !== undefined)
      data.expiryDate = new Date(dto.expiryDate);

    return this.repository.update(id, data);
  }

  async archive(id: string): Promise<Asset> {
    const asset = await this.findOne(id);
    if (asset.archivedAt !== null) {
      throw new BadRequestException('Asset is already archived');
    }
    return this.repository.update(id, { archivedAt: new Date() });
  }

  async restore(id: string): Promise<Asset> {
    const asset = await this.findOne(id);
    if (asset.archivedAt === null) {
      throw new BadRequestException('Asset is not archived');
    }
    return this.repository.update(id, { archivedAt: null });
  }

  async permanentDelete(id: string): Promise<void> {
    const asset = await this.findOne(id);
    if (asset.archivedAt === null) {
      throw new BadRequestException(
        'Asset must be archived first before permanent deletion',
      );
    }
    await this.repository.delete(id);
  }

  // ---------------------------------------------------------------------------
  // Rapid Entry — synchronous image/file upload linked to an asset
  //
  // Phase 1 (current): Synchronous — file is saved to disk and a Document
  //   record is created immediately. Returns 201 Created.
  //
  // Phase 2 (future): When queue infrastructure (BullMQ/Redis) is added,
  //   this method will enqueue a job for off-thread JPG→PDF conversion,
  //   the endpoint will return 202 Accepted, and the Document record will
  //   be created by the queue worker upon completion.
  // ---------------------------------------------------------------------------

  async rapidEntry(
    assetId: string,
    file: Express.Multer.File,
    caller: AuthenticatedUser,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException('An image or document file is required');
    }

    // Validate MIME type
    const ALLOWED_MIME_TYPES = [
      'image/jpeg',
      'image/png',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Unsupported file type. Allowed types: PDF, JPEG, PNG, DOCX',
      );
    }

    // Validate file size (max 10 MB)
    const MAX_SIZE_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException(
        'File exceeds the maximum allowed size of 10 MB',
      );
    }

    // Verify asset belongs to the tenant (scoped findUnique will 404 if not)
    const asset = await this.findOne(assetId);

    // Determine companyId from caller context or fall back to asset's companyId for SUPER_ADMIN
    let companyId = caller.companyId;
    if (caller.role === Role.SUPER_ADMIN) {
      companyId = asset.companyId;
    } else if (!companyId) {
      throw new BadRequestException(
        'Caller must belong to a company to upload files',
      );
    }

    const { fileUrl, originalFileName } =
      await this.storageService.saveFile(file);

    this.logger.log(
      `Rapid-entry file saved for asset ${assetId}: ${originalFileName} by user ${caller.userId}`,
    );

    // Create the Document record linked to this asset.
    // We use DocumentUncheckedCreateInput (flat fields) to allow direct assetId
    // assignment alongside the companyId, which avoids nested relation conflicts
    // in the Prisma type system when both company and asset are connected.
    const document = await this.prismaService.client.document.create({
      data: {
        title: originalFileName,
        originalFileName,
        fileUrl,
        // Documents uploaded via rapid-entry go under ASSET_DOCUMENTS by default.
        // Admins can later re-categorise via PATCH /documents/:id.
        section: 'ASSET_DOCUMENTS',
        companyId,
        assetId,
        userId: caller.userId,
      } as any,
    });

    this.logger.log(
      `Document record ${document.id} created for asset ${assetId}`,
    );

    return document;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Compute the traffic-light expiry status for a single asset.
   * Extracted so Module 2 can import and reuse this logic centrally.
   */
  private computeExpiryStatus(
    expiryDate: Date,
    now: Date,
    amberCutoff: Date,
  ): AssetExpiryStatus {
    if (expiryDate < now) return AssetExpiryStatus.EXPIRED;
    if (expiryDate <= amberCutoff) return AssetExpiryStatus.EXPIRING;
    return AssetExpiryStatus.VALID;
  }
}
