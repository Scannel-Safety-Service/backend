import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DocumentQueryDto } from './dto/document-query.dto';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a document (auto-scoped)' })
  async create(
    @Body() createDocumentDto: CreateDocumentDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    const document = await this.documentsService.create(createDocumentDto, file, caller);
    return {
      message: 'Document uploaded successfully',
      data: document,
    };
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.COMPANY_USER, Role.APP_USER)
  @ApiOperation({ summary: 'List and filter documents (auto-scoped)' })
  async findAll(
    @Query() queryDto: DocumentQueryDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    const result = await this.documentsService.findAll(queryDto, caller);
    return {
      message: 'Documents retrieved successfully',
      data: result,
    };
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.COMPANY_USER, Role.APP_USER)
  @ApiOperation({ summary: 'Get document details (scoping applied)' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    const document = await this.documentsService.findOne(id, caller);
    return {
      message: 'Document retrieved successfully',
      data: document,
    };
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update document metadata or replace uploaded file' })
  async update(
    @Param('id') id: string,
    @Body() updateDocumentDto: UpdateDocumentDto,
    @CurrentUser() caller: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const document = await this.documentsService.update(id, updateDocumentDto, caller, file);
    return {
      message: 'Document updated successfully',
      data: document,
    };
  }

  @Patch(':id/archive')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Soft archive a document (reversible)' })
  async archive(
    @Param('id') id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    const document = await this.documentsService.archive(id, caller);
    return {
      message: 'Document archived successfully',
      data: document,
    };
  }

  @Patch(':id/restore')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Restore an archived document' })
  async restore(
    @Param('id') id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    const document = await this.documentsService.restore(id, caller);
    return {
      message: 'Document restored successfully',
      data: document,
    };
  }

  @Delete(':id/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Permanently delete a document (must be archived first)' })
  @ApiResponse({ status: 204, description: 'Document permanently deleted' })
  async permanentDelete(
    @Param('id') id: string,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    await this.documentsService.permanentDelete(id, caller);
  }
}
