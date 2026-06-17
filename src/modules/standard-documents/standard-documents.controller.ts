import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CreateStandardDocumentDto } from './dto/create-standard-document.dto';
import { UpdateStandardDocumentDto } from './dto/update-standard-document.dto';
import { StandardDocumentQueryDto } from './dto/standard-document-query.dto';
import { StandardDocumentsService } from './standard-documents.service';

@ApiTags('standard-documents')
@ApiBearerAuth()
@Controller('standard-documents')
export class StandardDocumentsController {
  constructor(private readonly standardDocsService: StandardDocumentsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new global template (Super Admin only)' })
  async create(
    @Body() createDto: CreateStandardDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const doc = await this.standardDocsService.create(createDto, file);
    return {
      message: 'Global template created successfully',
      data: doc,
    };
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.COMPANY_USER, Role.APP_USER)
  @ApiOperation({ summary: 'List global template documents (accessible by all users)' })
  async findAll(@Query() queryDto: StandardDocumentQueryDto) {
    const result = await this.standardDocsService.findAll(queryDto);
    return {
      message: 'Global templates retrieved successfully',
      data: result,
    };
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.COMPANY_USER, Role.APP_USER)
  @ApiOperation({ summary: 'Get details of a global template' })
  async findOne(@Param('id') id: string) {
    const doc = await this.standardDocsService.findOne(id);
    return {
      message: 'Global template retrieved successfully',
      data: doc,
    };
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update global template or replace template file (Super Admin only)' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateStandardDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const doc = await this.standardDocsService.update(id, updateDto, file);
    return {
      message: 'Global template updated successfully',
      data: doc,
    };
  }

  @Patch(':id/archive')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Soft archive a global template (Super Admin only)' })
  async archive(@Param('id') id: string) {
    const doc = await this.standardDocsService.archive(id);
    return {
      message: 'Global template archived successfully',
      data: doc,
    };
  }

  @Patch(':id/restore')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Restore an archived global template (Super Admin only)' })
  async restore(@Param('id') id: string) {
    const doc = await this.standardDocsService.restore(id);
    return {
      message: 'Global template restored successfully',
      data: doc,
    };
  }

  @Delete(':id/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Permanently delete a global template (Super Admin only, must be archived first)' })
  @ApiResponse({ status: 204, description: 'Global template permanently deleted' })
  async permanentDelete(@Param('id') id: string) {
    await this.standardDocsService.permanentDelete(id);
  }
}
