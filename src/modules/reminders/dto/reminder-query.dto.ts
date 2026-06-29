import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class ReminderQueryDto {
  @ApiPropertyOptional({ description: 'Filter by parent user ID' })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by individual ID' })
  @IsUUID()
  @IsOptional()
  individualId?: string;

  @ApiPropertyOptional({
    description:
      'Filter by completion status (true: completed, false: pending, all: both). Defaults to all.',
  })
  @IsOptional()
  @IsString()
  completed?: 'true' | 'false' | 'all';

  @ApiPropertyOptional({
    description: 'Filter by archived status. Defaults to active only.',
  })
  @IsOptional()
  @IsString()
  archived?: 'true' | 'false' | 'all';

  @ApiPropertyOptional({
    example: 1,
    description: 'Page number for pagination',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    example: 10,
    description: 'Number of records per page',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;
}
