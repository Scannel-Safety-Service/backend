import { Controller, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { UsersService } from './users.service';

@ApiTags('document')
@ApiBearerAuth()
@Controller('document')
export class DocumentRestoreController {
  constructor(private readonly usersService: UsersService) {}

  @Patch(':id/restore')
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Restore an archived user using singular document endpoint' })
  async restore(@Param('id') id: string) {
    const user = await this.usersService.restore(id);
    return {
      message: 'User restored successfully',
      data: user,
    };
  }
}
