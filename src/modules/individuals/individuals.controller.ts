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
} from '@nestjs/common';
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
import { CreateIndividualDto } from './dto/create-individual.dto';
import { UpdateIndividualDto } from './dto/update-individual.dto';
import { IndividualQueryDto } from './dto/individual-query.dto';
import { IndividualsService } from './individuals.service';

@ApiTags('individuals')
@ApiBearerAuth()
@Controller('individuals')
export class IndividualsController {
  constructor(private readonly individualsService: IndividualsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Create a new individual (auto-scoped)' })
  async create(@Body() createDto: CreateIndividualDto) {
    const individual = await this.individualsService.create(createDto);
    return {
      message: 'Individual created successfully',
      data: individual,
    };
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.COMPANY_USER)
  @ApiOperation({ summary: 'List and filter individuals (auto-scoped)' })
  async findAll(
    @Query() queryDto: IndividualQueryDto,
    @CurrentUser() caller: AuthenticatedUser,
  ) {
    const result = await this.individualsService.findAll(queryDto, caller);
    return {
      message: 'Individuals retrieved successfully',
      data: result,
    };
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.COMPANY_USER)
  @ApiOperation({ summary: 'Get details of an individual (scoping applied)' })
  async findOne(@Param('id') id: string) {
    const individual = await this.individualsService.findOne(id);
    return {
      message: 'Individual retrieved successfully',
      data: individual,
    };
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Update an individual' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateIndividualDto,
  ) {
    const individual = await this.individualsService.update(id, updateDto);
    return {
      message: 'Individual updated successfully',
      data: individual,
    };
  }

  @Patch(':id/archive')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Soft archive an individual (reversible)' })
  async archive(@Param('id') id: string) {
    const individual = await this.individualsService.archive(id);
    return {
      message: 'Individual archived successfully',
      data: individual,
    };
  }

  @Patch(':id/restore')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Restore an archived individual' })
  async restore(@Param('id') id: string) {
    const individual = await this.individualsService.restore(id);
    return {
      message: 'Individual restored successfully',
      data: individual,
    };
  }

  @Delete(':id/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({
    summary: 'Soft-permanently delete an individual (sets isDeleted to true — stays in DB, hidden from UI forever). Must be archived first.',
  })
  @ApiResponse({ status: 204, description: 'Individual soft-permanently deleted' })
  async permanentDelete(@Param('id') id: string) {
    await this.individualsService.permanentDelete(id);
  }
}
