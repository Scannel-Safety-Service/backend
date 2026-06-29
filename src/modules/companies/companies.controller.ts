import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
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

@ApiTags('companies')
@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN)
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
  @ApiOperation({ summary: 'List all companies (Super Admin only)' })
  async findAll() {
    const companies = await this.companiesService.findAll();
    return {
      message: 'Companies retrieved successfully',
      data: companies,
    };
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
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
}
