import { ApiPropertyOptional } from '@nestjs/swagger';
import { AssetCategory } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateAssetDto {
  @ApiPropertyOptional({ description: 'Updated asset name / label' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated serial / identification number',
  })
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @ApiPropertyOptional({
    enum: AssetCategory,
    description: 'Updated asset compliance category',
  })
  @IsEnum(AssetCategory)
  @IsOptional()
  category?: AssetCategory;

  @ApiPropertyOptional({ description: 'Updated asset description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Updated ISO-8601 expiry date string',
    example: '2027-06-30T00:00:00.000Z',
  })
  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @ApiPropertyOptional({
    description: 'Updated Project ID (pass null to allocate to no project)',
    example: 'd3b07384-d113-4ec5-a587-353d9859f515',
  })
  @IsUUID()
  @IsOptional()
  projectId?: string | null;
}
