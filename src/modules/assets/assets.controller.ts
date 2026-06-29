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
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { AssetQueryDto } from './dto/asset-query.dto';

@ApiTags('assets')
@ApiBearerAuth()
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  // ---------------------------------------------------------------------------
  // POST /assets
  // ---------------------------------------------------------------------------
  @Post()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({
    summary: 'Create a new asset record (auto-scoped to caller company)',
  })
  async create(@Body() dto: CreateAssetDto) {
    const asset = await this.assetsService.create(dto);
    return {
      message: 'Asset created successfully',
      data: asset,
    };
  }

  // ---------------------------------------------------------------------------
  // GET /assets
  // ---------------------------------------------------------------------------
  @Get()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.COMPANY_USER, Role.APP_USER)
  @ApiOperation({
    summary:
      'List assets (auto-scoped). Supports category, expiryStatus (traffic-light), date range, and archived filters.',
  })
  async findAll(
    @Query() queryDto: AssetQueryDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    const result = await this.assetsService.findAll(queryDto, caller);
    return {
      message: 'Assets retrieved successfully',
      data: result,
    };
  }

  // ---------------------------------------------------------------------------
  // GET /assets/:id
  // ---------------------------------------------------------------------------
  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.COMPANY_USER, Role.APP_USER)
  @ApiOperation({
    summary: 'Get full asset detail including attached documents',
  })
  async findOne(@Param('id') id: string) {
    const asset = await this.assetsService.findOne(id);
    return {
      message: 'Asset retrieved successfully',
      data: asset,
    };
  }

  // ---------------------------------------------------------------------------
  // PATCH /assets/:id
  // ---------------------------------------------------------------------------
  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Update asset metadata' })
  async update(@Param('id') id: string, @Body() dto: UpdateAssetDto) {
    const asset = await this.assetsService.update(id, dto);
    return {
      message: 'Asset updated successfully',
      data: asset,
    };
  }

  // ---------------------------------------------------------------------------
  // PATCH /assets/:id/archive
  // ---------------------------------------------------------------------------
  @Patch(':id/archive')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({
    summary:
      'Soft-archive an asset (reversible). Step 1 of double-gated deletion.',
  })
  async archive(@Param('id') id: string) {
    const asset = await this.assetsService.archive(id);
    return {
      message: 'Asset archived successfully',
      data: asset,
    };
  }

  // ---------------------------------------------------------------------------
  // PATCH /assets/:id/restore
  // ---------------------------------------------------------------------------
  @Patch(':id/restore')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Restore a soft-archived asset' })
  async restore(@Param('id') id: string) {
    const asset = await this.assetsService.restore(id);
    return {
      message: 'Asset restored successfully',
      data: asset,
    };
  }

  // ---------------------------------------------------------------------------
  // DELETE /assets/:id/permanent
  // ---------------------------------------------------------------------------
  @Delete(':id/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({
    summary:
      'Permanently delete an asset. Asset MUST be archived first (double-gated deletion pattern).',
  })
  @ApiResponse({ status: 204, description: 'Asset permanently deleted' })
  async permanentDelete(@Param('id') id: string) {
    await this.assetsService.permanentDelete(id);
  }

  // ---------------------------------------------------------------------------
  // POST /assets/:id/rapid-entry
  //
  // Mobile-first rapid asset induction endpoint.
  // Accepts an image or document file, saves it to storage, and immediately
  // creates a Document record linked to the asset.
  //
  // PHASE 1 (current): Synchronous — returns 201 with the created Document.
  // PHASE 2 (future):  Will become async (202 Accepted) once BullMQ/Redis
  //                    queue infrastructure is added (see AssetsService).
  // ---------------------------------------------------------------------------
  @Post(':id/rapid-entry')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.COMPANY_USER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Rapid-entry: upload a certificate image or file and link it to an asset. ' +
      'Phase 1 is synchronous. Phase 2 will queue JPG→PDF conversion off-thread.',
  })
  @ApiResponse({
    status: 201,
    description:
      'File saved and a Document record linked to the asset. ' +
      'In a future async phase, this will return 202 Accepted.',
  })
  async rapidEntry(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    const document = await this.assetsService.rapidEntry(id, file, caller);
    return {
      message: 'File uploaded and linked to asset successfully',
      data: document,
    };
  }
}
