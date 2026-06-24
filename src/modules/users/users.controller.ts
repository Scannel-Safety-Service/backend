import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.COMPANY_USER, Role.APP_USER)
  @ApiOperation({ summary: 'List and filter users (auto-scoped to caller company except Super Admin)' })
  async findAll(@Query() queryDto: UserQueryDto) {
    const result = await this.usersService.findAll(queryDto);
    return {
      message: 'Users retrieved successfully',
      data: result,
    };
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN, Role.COMPANY_USER, Role.APP_USER)
  @ApiOperation({ summary: 'Get details of a user (scoping applied)' })
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findOne(id);
    return {
      message: 'User retrieved successfully',
      data: user,
    };
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Update user details' })
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    const user = await this.usersService.update(id, dto);
    return {
      message: 'User updated successfully',
      data: user,
    };
  }

  @Patch(':id/archive')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Soft archive a user (reversible)' })
  async archive(@Param('id') id: string) {
    const user = await this.usersService.archive(id);
    return {
      message: 'User archived successfully',
      data: user,
    };
  }

  @Patch(':id/restore')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Restore an archived user' })
  async restore(@Param('id') id: string) {
    const user = await this.usersService.restore(id);
    return {
      message: 'User restored successfully',
      data: user,
    };
  }

  @Delete(':id/permanent')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Irreversibly delete a user (must be archived first)' })
  @ApiResponse({ status: 204, description: 'User permanently deleted' })
  async permanentDelete(@Param('id') id: string) {
    await this.usersService.permanentDelete(id);
  }

  @Post(':id/send-welcome-email')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Send welcome/invitation email to a user' })
  @ApiResponse({ status: 200, description: 'Welcome email sent successfully' })
  async sendWelcomeEmail(@Param('id') id: string) {
    await this.usersService.sendWelcomeEmail(id);
    return {
      message: 'Welcome email sent successfully.',
      data: null,
    };
  }

  @Post(':id/issue-to-client')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Send credentials/issue email to a user/client' })
  @ApiResponse({ status: 200, description: 'Credentials email sent successfully' })
  async issueToClient(@Param('id') id: string) {
    await this.usersService.issueToClient(id);
    return {
      message: 'Credentials email sent successfully.',
      data: null,
    };
  }
}
