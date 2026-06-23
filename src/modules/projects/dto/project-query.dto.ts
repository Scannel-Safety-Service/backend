import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ProjectQueryDto {
  @ApiPropertyOptional({ description: 'Filter by archive status: "true", "false", or "all" (default: "false")' })
  @IsString()
  @IsOptional()
  archived?: string;

  @ApiPropertyOptional({ description: 'Filter by specific year (e.g. 2026)' })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  @IsOptional()
  year?: number;

  @ApiPropertyOptional({ description: 'Optional company ID (accessible only by Super Admin)' })
  @IsUUID()
  @IsOptional()
  companyId?: string;
}
