import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Category, DocumentSection } from '@prisma/client';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';
import { CategoriesRepository } from './categories.repository';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categoriesRepository: CategoriesRepository,
    private readonly prismaService: TenantPrismaService,
  ) { }

  async create(
    dto: CreateCategoryDto,
    creator: AuthenticatedUser,
  ): Promise<Category> {
    // Validate section
    if (
      dto.section !== DocumentSection.COMPANY_DOCUMENTS &&
      dto.section !== DocumentSection.RISK_ASSESSMENT
    ) {
      throw new BadRequestException(
        'Categories can only be created in COMPANY_DOCUMENTS or RISK_ASSESSMENT sections',
      );
    }

    // If Company Admin, they can only assign categories to users in their own company.
    // If Super Admin, they can assign to any user.
    if (!dto.assignToAll && dto.userId) {
      const allowedUserCount = await this.prismaService.client.user.count({
        where: {
          id: dto.userId,
          companyId: creator.companyId ? creator.companyId : undefined,
        },
      });

      if (allowedUserCount !== 1) {
        throw new BadRequestException(
          'Assigned user does not exist or does not belong to your company',
        );
      }
    }

    const data: Prisma.CategoryCreateInput = {
      name: dto.name,
      section: dto.section,
      assignToAll: dto.assignToAll,
      createdBy: { connect: { id: creator.userId } },

      company: creator.companyId
        ? { connect: { id: creator.companyId } }
        : undefined,
    };

    const category = await this.categoriesRepository.create(data);

    // Create user assignment if not assignToAll and userId is provided
    if (!dto.assignToAll && dto.userId) {
      await this.prismaService.client.categoryUser.create({
        data: {
          categoryId: category.id,
          userId: dto.userId,
        },
      });
    }

    return this.findOne(category.id);
  }

  async findAll(queryDto: CategoryQueryDto, caller: AuthenticatedUser) {
    const where: Prisma.CategoryWhereInput = {};

    if (queryDto.section) {
      where.section = queryDto.section;
    }

    // Apply security check: if the caller is not an Admin, they can ONLY query categories assigned to themselves
    let targetUserId = queryDto.userId;
    if (
      caller.role !== Role.SUPER_ADMIN &&
      caller.role !== Role.COMPANY_ADMIN
    ) {
      targetUserId = caller.userId;
    }

    if (targetUserId) {
      // Fetch the target user's companyId using bypass client to ensure accurate mapping
      const targetUser = await this.prismaService.client.user.findUnique({
        where: { id: targetUserId },
        select: { companyId: true },
      });
      const targetUserCompanyId = targetUser?.companyId || null;

      // Filter by assignments OR assignToAll
      where.OR = [
        {
          assignToAll: true,
          OR: [
            { companyId: null },
            targetUserCompanyId ? { companyId: targetUserCompanyId } : {},
          ].filter(Boolean),
        },
        {
          assignments: {
            some: {
              userId: targetUserId,
            },
          },
        },
      ];
    }

    if (queryDto.archived === 'true') {
      where.archivedAt = { not: null };
    } else if (queryDto.archived === 'false' || !queryDto.archived) {
      where.archivedAt = null;
    }
    // Permanently soft-deleted records are NEVER visible via API
    where.isDeleted = false;

    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;

    const [items, total] = await this.categoriesRepository.findAndCount(
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

  async findOne(id: string): Promise<Category> {
    const category = await this.categoriesRepository.findById(id);
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    // Permanently soft-deleted records are invisible via API
    if (category.isDeleted) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async update(
    id: string,
    dto: UpdateCategoryDto,
    updater: AuthenticatedUser,
  ): Promise<Category> {
    const category = await this.findOne(id);

    // If category is global, only SUPER_ADMIN can update it.
    if (category.companyId === null && updater.role !== Role.SUPER_ADMIN) {
      throw new BadRequestException(
        'Only Super Admins can update global categories',
      );
    }

    // Validate section if updated
    if (
      dto.section &&
      dto.section !== DocumentSection.COMPANY_DOCUMENTS &&
      dto.section !== DocumentSection.RISK_ASSESSMENT
    ) {
      throw new BadRequestException(
        'Categories can only belong to COMPANY_DOCUMENTS or RISK_ASSESSMENT sections',
      );
    }

    // Verify user id is valid and belongs to the company
    if (dto.assignToAll === false && dto.userId) {
      const allowedUserCount = await this.prismaService.client.user.count({
        where: {
          id: dto.userId,
          companyId: updater.companyId ? updater.companyId : undefined,
        },
      });

      if (allowedUserCount !== 1) {
        throw new BadRequestException(
          'Assigned user does not exist or does not belong to your company',
        );
      }
    }

    const updateData: Prisma.CategoryUpdateInput = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.section !== undefined) updateData.section = dto.section;
    if (dto.assignToAll !== undefined) updateData.assignToAll = dto.assignToAll;

    await this.categoriesRepository.update(id, updateData);

    // Sync assignments
    const finalAssignToAll =
      dto.assignToAll !== undefined ? dto.assignToAll : category.assignToAll;

    if (finalAssignToAll) {
      // Delete all specific user assignments if assignToAll is enabled
      await this.prismaService.client.categoryUser.deleteMany({
        where: { categoryId: id },
      });
    } else if (dto.userId !== undefined) {
      // Delete existing assignments and create new one
      await this.prismaService.client.categoryUser.deleteMany({
        where: { categoryId: id },
      });
      if (dto.userId) {
        await this.prismaService.client.categoryUser.create({
          data: {
            categoryId: id,
            userId: dto.userId,
          },
        });
      }
    }

    return this.findOne(id);
  }

  async archive(id: string, user: AuthenticatedUser): Promise<Category> {
    const category = await this.findOne(id);
    if (category.companyId === null && user.role !== Role.SUPER_ADMIN) {
      throw new BadRequestException(
        'Only Super Admins can archive global categories',
      );
    }
    if (category.archivedAt !== null) {
      throw new BadRequestException('Category is already archived');
    }

    return this.categoriesRepository.update(id, {
      archivedAt: new Date(),
    });
  }

  async restore(id: string, user: AuthenticatedUser): Promise<Category> {
    const category = await this.findOne(id);
    if (category.companyId === null && user.role !== Role.SUPER_ADMIN) {
      throw new BadRequestException(
        'Only Super Admins can restore global categories',
      );
    }
    if (category.archivedAt === null) {
      throw new BadRequestException('Category is not archived');
    }

    return this.categoriesRepository.update(id, {
      archivedAt: null,
    });
  }

  async getLinkedDocuments(
    id: string,
    user: AuthenticatedUser,
  ): Promise<{ items: any[]; total: number }> {
    await this.findOne(id);

    const [items, total] = await this.prismaService.client.$transaction([
      this.prismaService.client.document.findMany({
        where: {
          categoryId: id,
          isDeleted: false,
        },
        select: {
          id: true,
          title: true,
          originalFileName: true,
          archivedAt: true,
          company: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50,
      }),
      this.prismaService.client.document.count({
        where: {
          categoryId: id,
          isDeleted: false,
        },
      }),
    ]);

    return {
      items,
      total,
    };
  }

  /**
   * Soft permanent delete — sets isDeleted to true.
   * Record is permanently hidden from the UI but remains in the database forever.
   * Also soft-deletes all linked documents by setting isDeleted to true.
   */
  async permanentDelete(id: string, user: AuthenticatedUser): Promise<void> {
    const category = await this.findOne(id);
    if (category.companyId === null && user.role !== Role.SUPER_ADMIN) {
      throw new BadRequestException(
        'Only Super Admins can permanently delete global categories',
      );
    }
    await this.categoriesRepository.update(id, { isDeleted: true });
    await this.prismaService.client.document.updateMany({
      where: {
        categoryId: id,
        isDeleted: false,
      },
      data: {
        isDeleted: true,
      },
    });
  }
}
