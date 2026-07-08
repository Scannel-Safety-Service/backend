import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { TenantCacheInterceptor } from '../../common/interceptors/tenant-cache.interceptor';
import { CacheEvict } from '../../common/decorators/cache-evict.decorator';
import { CacheEvictInterceptor } from '../../common/interceptors/cache-evict.interceptor';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';
import { CategoriesService } from './categories.service';

@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) { }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @UseInterceptors(CacheEvictInterceptor)
  @CacheEvict({ key: 'categories', isTenantScoped: true })
  @ApiOperation({
    summary:
      'Create a new category (auto-scoped to caller company except Super Admin)',
  })
  async create(
    @Body() createCategoryDto: CreateCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const category = await this.categoriesService.create(
      createCategoryDto,
      user,
    );
    return {
      message: 'Category created successfully',
      data: category,
    };
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.COMPANY_USER, Role.APP_USER)
  @UseInterceptors(TenantCacheInterceptor)
  @ApiOperation({ summary: 'List and filter categories (auto-scoped)' })
  async findAll(
    @Query() queryDto: CategoryQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.categoriesService.findAll(queryDto, user);

    return {
      message: 'Categories retrieved successfully',
      data: result,
    };
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.COMPANY_USER, Role.APP_USER)
  @UseInterceptors(TenantCacheInterceptor)
  @ApiOperation({ summary: 'Get details of a category (scoping applied)' })
  async findOne(@Param('id') id: string) {
    const category = await this.categoriesService.findOne(id);
    return {
      message: 'Category retrieved successfully',
      data: category,
    };
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @UseInterceptors(CacheEvictInterceptor)
  @CacheEvict({ key: 'categories', isTenantScoped: true })
  @ApiOperation({ summary: 'Update a category' })
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const category = await this.categoriesService.update(
      id,
      updateCategoryDto,
      user,
    );
    return {
      message: 'Category updated successfully',
      data: category,
    };
  }

  @Patch(':id/archive')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @UseInterceptors(CacheEvictInterceptor)
  @CacheEvict({ key: 'categories', isTenantScoped: true })
  @ApiOperation({ summary: 'Soft archive a category (reversible)' })
  async archive(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const category = await this.categoriesService.archive(id, user);
    return {
      message: 'Category archived successfully',
      data: category,
    };
  }

  @Patch(':id/restore')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @UseInterceptors(CacheEvictInterceptor)
  @CacheEvict({ key: 'categories', isTenantScoped: true })
  @ApiOperation({ summary: 'Restore an archived category' })
  async restore(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const category = await this.categoriesService.restore(id, user);
    return {
      message: 'Category restored successfully',
      data: category,
    };
  }

  @Get(':id/linked-documents')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Get list of documents linked to a category' })
  async getLinkedDocuments(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.categoriesService.getLinkedDocuments(id, user);
    return {
      message: 'Linked documents retrieved successfully',
      data: result,
    };
  }

  @Delete(':id/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @UseInterceptors(CacheEvictInterceptor)
  @CacheEvict({ key: 'categories', isTenantScoped: true })
  @ApiOperation({
    summary: 'Irreversibly delete a category (must be archived first)',
  })
  @ApiResponse({ status: 204, description: 'Category permanently deleted' })
  async permanentDelete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.categoriesService.permanentDelete(id, user);
  }
}
