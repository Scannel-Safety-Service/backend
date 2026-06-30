import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UserQueryDto {
  @ApiPropertyOptional({
    description: 'Filter users by first name or last name substring',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Filter users by email substring' })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Filter users by their unique userCode' })
  @IsString()
  @IsOptional()
  userCode?: string;

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

  @ApiPropertyOptional({
    description: 'Filter users by archive status ("true" or "false")',
  })
  @IsString()
  @IsOptional()
  archived?: string;
}
