import { ApiPropertyOptional } from '@nestjs/swagger';
import { AssetCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

/**
 * Expiry status filter — maps to the Module 2 Traffic Light System.
 * Thresholds are evaluated server-side so they can later be made
 * configurable per company (Module 2 CompanySettings).
 *
 * DEFAULT amber threshold = 30 days (configurable in Module 2).
 */
export enum AssetExpiryStatus {
  EXPIRED = 'expired', // expiryDate < now()
  EXPIRING = 'expiring', // now() <= expiryDate <= now() + amberThresholdDays
  VALID = 'valid', // expiryDate > now() + amberThresholdDays
}

export class AssetQueryDto {
  @ApiPropertyOptional({
    enum: AssetCategory,
    description: 'Filter assets by category',
  })
  @IsEnum(AssetCategory)
  @IsOptional()
  category?: AssetCategory;

  @ApiPropertyOptional({
    enum: AssetExpiryStatus,
    description:
      'Filter by compliance expiry status. ' +
      '"expired" = past expiry, "expiring" = within 30 days, "valid" = more than 30 days remaining. ' +
      'Module 2 will make the amber threshold configurable per company.',
  })
  @IsEnum(AssetExpiryStatus)
  @IsOptional()
  expiryStatus?: AssetExpiryStatus;

  @ApiPropertyOptional({
    description:
      'Filter by archived state. Defaults to active (non-archived) only.',
  })
  @IsString()
  @IsOptional()
  archived?: 'true' | 'false' | 'all';

  @ApiPropertyOptional({
    description: 'Filter by company ID (SUPER_ADMIN only)',
  })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({
    example: '2026-01-01T00:00:00.000Z',
    description: 'Filter assets with expiryDate on or after this ISO-8601 date',
  })
  @IsISO8601()
  @IsOptional()
  expiryFrom?: string;

  @ApiPropertyOptional({
    example: '2026-12-31T23:59:59.999Z',
    description:
      'Filter assets with expiryDate on or before this ISO-8601 date',
  })
  @IsISO8601()
  @IsOptional()
  expiryTo?: string;

  @ApiPropertyOptional({ example: 1, description: 'Page number (1-based)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, description: 'Records per page' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter assets by project ID',
    example: 'd3b07384-d113-4ec5-a587-353d9859f515',
  })
  @IsUUID()
  @IsOptional()
  projectId?: string;
}
