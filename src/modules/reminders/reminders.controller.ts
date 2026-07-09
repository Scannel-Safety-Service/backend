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
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { ReminderQueryDto } from './dto/reminder-query.dto';
import { RemindersService } from './reminders.service';

@ApiTags('reminders')
@ApiBearerAuth()
@Controller('reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Create a new reminder (auto-scoped)' })
  async create(@Body() createDto: CreateReminderDto) {
    const reminder = await this.remindersService.create(createDto);
    return {
      message: 'Reminder created successfully',
      data: reminder,
    };
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.COMPANY_USER, Role.APP_USER)
  @ApiOperation({ summary: 'List and filter reminders (auto-scoped)' })
  async findAll(@Query() queryDto: ReminderQueryDto) {
    const result = await this.remindersService.findAll(queryDto);
    return {
      message: 'Reminders retrieved successfully',
      data: result,
    };
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.COMPANY_USER, Role.APP_USER)
  @ApiOperation({ summary: 'Get details of a reminder (scoping applied)' })
  async findOne(@Param('id') id: string) {
    const reminder = await this.remindersService.findOne(id);
    return {
      message: 'Reminder retrieved successfully',
      data: reminder,
    };
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Update a reminder' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateReminderDto) {
    const reminder = await this.remindersService.update(id, updateDto);
    return {
      message: 'Reminder updated successfully',
      data: reminder,
    };
  }

  @Patch(':id/complete')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Mark a reminder as completed' })
  async complete(@Param('id') id: string) {
    const reminder = await this.remindersService.complete(id);
    return {
      message: 'Reminder completed successfully',
      data: reminder,
    };
  }

  @Patch(':id/archive')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Soft archive a reminder (reversible)' })
  async archive(@Param('id') id: string) {
    const reminder = await this.remindersService.archive(id);
    return {
      message: 'Reminder archived successfully',
      data: reminder,
    };
  }

  @Patch(':id/restore')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Restore an archived reminder' })
  async restore(@Param('id') id: string) {
    const reminder = await this.remindersService.restore(id);
    return {
      message: 'Reminder restored successfully',
      data: reminder,
    };
  }

  @Delete(':id/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({
    summary: 'Soft-permanently delete a reminder (sets isDeleted to true — stays in DB, hidden from UI forever). Must be archived first.',
  })
  @ApiResponse({ status: 204, description: 'Reminder soft-permanently deleted' })
  async permanentDelete(@Param('id') id: string) {
    await this.remindersService.permanentDelete(id);
  }
}
