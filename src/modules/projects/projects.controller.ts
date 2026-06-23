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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectQueryDto } from './dto/project-query.dto';
import { UploadProjectDocumentDto } from './dto/upload-project-document.dto';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Create a new project record and trigger background folder seeding' })
  async create(@Body() dto: CreateProjectDto, @CurrentUser() caller: AuthenticatedUser) {
    const project = await this.projectsService.create(dto, caller);
    return {
      message: 'Project created successfully',
      data: project,
    };
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.COMPANY_USER, Role.APP_USER)
  @ApiOperation({ summary: 'List and filter active projects organized by calendar year' })
  async findAll(@Query() queryDto: ProjectQueryDto, @CurrentUser() caller: AuthenticatedUser) {
    const result = await this.projectsService.findAll(queryDto, caller);
    return {
      message: 'Projects retrieved successfully',
      data: result,
    };
  }

  @Get(':id/folders')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.COMPANY_USER, Role.APP_USER)
  @ApiOperation({ summary: 'Retrieve folders and their document structures for a specific project' })
  async findFolders(@Param('id') id: string) {
    const project = await this.projectsService.findFolders(id);
    return {
      message: 'Folders retrieved successfully',
      data: project,
    };
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Modify project name, year, or other details' })
  async update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    const project = await this.projectsService.update(id, dto);
    return {
      message: 'Project updated successfully',
      data: project,
    };
  }

  @Patch(':id/archive')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Soft archive a project (reversible)' })
  async archive(@Param('id') id: string) {
    const project = await this.projectsService.archive(id);
    return {
      message: 'Project archived successfully',
      data: project,
    };
  }

  @Patch(':id/restore')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Restore a soft-archived project' })
  async restore(@Param('id') id: string) {
    const project = await this.projectsService.restore(id);
    return {
      message: 'Project restored successfully',
      data: project,
    };
  }

  @Delete(':id/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Permanently delete a project (must be archived first)' })
  @ApiResponse({ status: 204, description: 'Project permanently deleted' })
  async permanentDelete(@Param('id') id: string) {
    await this.projectsService.permanentDelete(id);
  }

  @Post(':projectId/folders/:folderId/documents')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.COMPANY_USER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a document directly into a specific project folder' })
  @ApiResponse({ status: 201, description: 'Document uploaded and linked successfully' })
  async uploadDocument(
    @Param('projectId') projectId: string,
    @Param('folderId') folderId: string,
    @Body() dto: UploadProjectDocumentDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    const document = await this.projectsService.uploadDocument(
      projectId,
      folderId,
      dto,
      file,
      caller,
    );
    return {
      message: 'Document uploaded to project folder successfully',
      data: document,
    };
  }
}
