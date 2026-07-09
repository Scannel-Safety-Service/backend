import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { StatsService } from './stats.service';
import { CacheInterceptor } from '@nestjs/cache-manager';

@ApiTags('stats')
@ApiBearerAuth()
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN)
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({
    summary: 'Get platform-wide statistics (Super Admin only)',
    description:
      'Returns aggregate counts and breakdowns for companies, users, projects, and assets. Cached for 60 seconds.',
  })
  async getPlatformStats() {
    const data = await this.statsService.getPlatformStats();
    return {
      message: 'Platform statistics retrieved successfully',
      data,
    };
  }
}
