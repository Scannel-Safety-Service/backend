import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Category } from '@prisma/client';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';
import { CategoriesRepository } from './categories.repository';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categoriesRepository: CategoriesRepository,
    private readonly prismaService: TenantPrismaService,
  ) {}

  async create(dto: CreateCategoryDto): Promise<Category> {
    // If a userId is provided, verify the user exists and belongs to the same company
    if (dto.userId) {
      await this.verifyUserBelongsToTenant(dto.userId);
    }

    const data: Prisma.CategoryCreateInput = {
      name: dto.name,
      section: dto.section,
      company: { connect: { id: '' } }, // Injected by TenantPrismaService query hook, but Prisma needs type-safety
    };

    if (dto.userId) {
      data.user = { connect: { id: dto.userId } };
    }

    return this.categoriesRepository.create(data);
  }

  async findAll(queryDto: CategoryQueryDto) {
    const where: Prisma.CategoryWhereInput = {};

    if (queryDto.section) {
      where.section = queryDto.section;
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

    const [items, total] = await this.categoriesRepository.findAndCount(where, page, limit);

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

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);

    if (dto.userId) {
      await this.verifyUserBelongsToTenant(dto.userId);
    }

    const updateData: Prisma.CategoryUpdateInput = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.section !== undefined) updateData.section = dto.section;
    
    if (dto.userId !== undefined) {
      if (dto.userId === null) {
        updateData.user = { disconnect: true };
      } else {
        updateData.user = { connect: { id: dto.userId } };
      }
    }

    return this.categoriesRepository.update(id, updateData);
  }

  async archive(id: string): Promise<Category> {
    const category = await this.findOne(id);
    if (category.archivedAt !== null) {
      throw new BadRequestException('Category is already archived');
    }

    return this.categoriesRepository.update(id, {
      archivedAt: new Date(),
    });
  }

  async restore(id: string): Promise<Category> {
    const category = await this.findOne(id);
    if (category.archivedAt === null) {
      throw new BadRequestException('Category is not archived');
    }

    return this.categoriesRepository.update(id, {
      archivedAt: null,
    });
  }

  async permanentDelete(id: string): Promise<void> {
    const category = await this.findOne(id);
    if (category.archivedAt === null) {
      throw new BadRequestException('Category must be archived first before permanent deletion');
    }

    await this.categoriesRepository.delete(id);
  }

  private async verifyUserBelongsToTenant(userId: string): Promise<void> {
    // Fetch user using base client to bypass tenant filter (or it will filter naturally by client scope)
    const user = await this.prismaService.client.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('Scoped user not found');
    }
  }
}
