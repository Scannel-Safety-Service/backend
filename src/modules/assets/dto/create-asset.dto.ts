import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssetCategory } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateAssetDto {
  @ApiProperty({
    description: 'Human-readable name or label for the asset',
    example: 'Telescopic Handler Unit 4',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Unique serial / identification number printed on the asset',
    example: 'SN-2024-TH-00412',
  })
  @IsString()
  @IsNotEmpty()
  serialNumber: string;

  @ApiProperty({
    enum: AssetCategory,
    description: 'Asset compliance category',
    example: AssetCategory.PLANT,
  })
  @IsEnum(AssetCategory)
  category: AssetCategory;

  @ApiProperty({
    description:
      'Detailed description of the asset — make, model, location, etc.',
    example: 'Manitou MT 1840 — Yard A, Bay 3',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description:
      'ISO-8601 date string for the asset certificate / calibration expiry date',
    example: '2026-12-31T00:00:00.000Z',
  })
  @IsDateString()
  expiryDate: string;

  @ApiPropertyOptional({
    description: 'Optional company ID (required for Super Admin)',
    example: 'd3b07384-d113-4ec5-a587-353d9859f515',
  })
  @IsUUID()
  @IsOptional()
  companyId?: string;

  @ApiPropertyOptional({
    description: 'Optional Project ID to allocate the asset to',
    example: 'd3b07384-d113-4ec5-a587-353d9859f515',
  })
  @IsUUID()
  @IsOptional()
  projectId?: string;
}
