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
  ) {}

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
    if (dto.userIds && dto.userIds.length > 0) {
      const allowedUsersCount = await this.prismaService.client.user.count({
        where: {
          id: { in: dto.userIds },
          companyId: creator.companyId ? creator.companyId : undefined,
        },
      });

      if (allowedUsersCount !== dto.userIds.length) {
        throw new BadRequestException(
          'Some assigned users do not exist or do not belong to your company',
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

    // Create user assignments if not assignToAll and userIds are provided
    if (!dto.assignToAll && dto.userIds && dto.userIds.length > 0) {
      const assignmentData = dto.userIds.map((userId) => ({
        categoryId: category.id,
        userId,
      }));
      await this.prismaService.client.categoryUser.createMany({
        data: assignmentData,
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

    if (caller.role !== Role.SUPER_ADMIN && !targetUserId) {
      where.companyId = caller.companyId;
    }

    if (queryDto.archived === 'true') {
      where.archivedAt = { not: null };
    } else if (queryDto.archived === 'false' || !queryDto.archived) {
      where.archivedAt = null;
    }

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

    // Verify user ids are valid and belong to the company
    if (dto.userIds && dto.userIds.length > 0) {
      const allowedUsersCount = await this.prismaService.client.user.count({
        where: {
          id: { in: dto.userIds },
          companyId: updater.companyId ? updater.companyId : undefined,
        },
      });

      if (allowedUsersCount !== dto.userIds.length) {
        throw new BadRequestException(
          'Some assigned users do not exist or do not belong to your company',
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
    } else if (dto.userIds !== undefined) {
      // Synchronize the CategoryUser junction table records
      const existingAssignments =
        await this.prismaService.client.categoryUser.findMany({
          where: { categoryId: id },
          select: { userId: true },
        });
      const existingUserIds = existingAssignments.map((a) => a.userId);

      const toAdd = dto.userIds.filter(
        (userId) => !existingUserIds.includes(userId),
      );
      const toRemove = existingUserIds.filter(
        (userId) => !dto.userIds!.includes(userId),
      );

      if (toRemove.length > 0) {
        await this.prismaService.client.categoryUser.deleteMany({
          where: {
            categoryId: id,
            userId: { in: toRemove },
          },
        });
      }

      if (toAdd.length > 0) {
        await this.prismaService.client.categoryUser.createMany({
          data: toAdd.map((userId) => ({
            categoryId: id,
            userId,
          })),
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

  async permanentDelete(id: string, user: AuthenticatedUser): Promise<void> {
    const category = await this.findOne(id);
    if (category.companyId === null && user.role !== Role.SUPER_ADMIN) {
      throw new BadRequestException(
        'Only Super Admins can permanently delete global categories',
      );
    }
    if (category.archivedAt === null) {
      throw new BadRequestException(
        'Category must be archived first before permanent deletion',
      );
    }

    await this.categoriesRepository.delete(id);
  }
}
