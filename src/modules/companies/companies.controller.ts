import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseInterceptors } from '@nestjs/common';
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
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyQueryDto } from './dto/company-query.dto';

@ApiTags('companies')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN)
  @UseInterceptors(CacheEvictInterceptor)
  @CacheEvict({ key: 'companies' })
  @ApiOperation({ summary: 'Create a new company (Super Admin only)' })
  @ApiResponse({ status: 201, description: 'Company created successfully' })
  async create(@Body() dto: CreateCompanyDto) {
    const company = await this.companiesService.create(dto);
    return {
      message: 'Company created successfully',
      data: company,
    };
  }

  @Get()
  @Roles(Role.SUPER_ADMIN)
  @UseInterceptors(TenantCacheInterceptor)
  @ApiOperation({ summary: 'List all companies (Super Admin only)' })
  async findAll(@Query() queryDto: CompanyQueryDto) {
    const result = await this.companiesService.findAll(queryDto);
    return {
      message: 'Companies retrieved successfully',
      data: result,
    };
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @UseInterceptors(TenantCacheInterceptor)
  @ApiOperation({
    summary: 'Get details of a company (Super Admin or matching Company Admin)',
  })
  async findOne(@Param('id') id: string) {
    const company = await this.companiesService.findOne(id);
    return {
      message: 'Company retrieved successfully',
      data: company,
    };
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @UseInterceptors(CacheEvictInterceptor)
  @CacheEvict({ key: 'companies' })
  @ApiOperation({
    summary: 'Update company settings (Super Admin or matching Company Admin)',
  })
  async update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    const company = await this.companiesService.update(id, dto);
    return {
      message: 'Company updated successfully',
      data: company,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.SUPER_ADMIN)
  @UseInterceptors(CacheEvictInterceptor)
  @CacheEvict({ key: 'companies' })
  @ApiOperation({
    summary: 'Soft delete a company (sets isDeleted to true)',
  })
  @ApiResponse({ status: 204, description: 'Company soft deleted successfully' })
  async delete(@Param('id') id: string) {
    await this.companiesService.delete(id);
  }
}
