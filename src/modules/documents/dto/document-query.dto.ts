import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentSection } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class DocumentQueryDto {
  @ApiPropertyOptional({
    enum: DocumentSection,
    description: 'Filter documents by section',
  })
  @IsEnum(DocumentSection)
  @IsOptional()
  section?: DocumentSection;

  @ApiPropertyOptional({ description: 'Filter documents by category ID' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Filter documents by scoped user ID' })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    description:
      'Filter documents by company ID (accessible by Super Admin only)',
  })
  @IsUUID()
  @IsOptional()
  companyId?: string;

  @ApiPropertyOptional({
    description:
      'Filter to show only archived, only active, or all. Defaults to active only.',
  })
  @IsOptional()
  @IsString()
  archived?: 'true' | 'false' | 'all';

  @ApiPropertyOptional({
    description:
      'Scope results to documents belonging to a specific project (by project ID)',
  })
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional({
    description:
      'Scope results to documents within a specific compliance folder (by folder ID)',
  })
  @IsUUID()
  @IsOptional()
  folderId?: string;

  // ── Interrogation/Search filters ──────────────────────────────────────────────

  @ApiPropertyOptional({
    description: 'Filter by document upload date from (ISO 8601)',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter by document upload date to (ISO 8601)',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({
    description:
      'Filter by signatory user ID — returns documents uploaded by this user',
  })
  @IsOptional()
  @IsUUID()
  signatoryId?: string;

  @ApiPropertyOptional({
    description:
      'Filter by document type (e.g. INSPECTION_REPORT, SIGN_OFF, PERMIT, CERTIFICATE, OTHER)',
  })
  @IsOptional()
  @IsString()
  documentType?: string;

  @ApiPropertyOptional({
    description:
      'Filter by inspection type (e.g. DAILY, WEEKLY, MONTHLY, ANNUAL, ADHOC)',
  })
  @IsOptional()
  @IsString()
  inspectionType?: string;

  @ApiPropertyOptional({
    description: 'Full-text keyword search across document title and filename',
    example: 'safety inspection',
  })
  @IsOptional()
  @IsString()
  keyword?: string;

  // ── Pagination ────────────────────────────────────────────────────────────────

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
