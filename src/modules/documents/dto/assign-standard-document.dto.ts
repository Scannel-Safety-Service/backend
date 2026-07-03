import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentSection } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class AssignStandardDocumentDto {
  @ApiProperty({ description: 'ID of the StandardDocument template to assign' })
  @IsUUID()
  standardDocumentId: string;

  @ApiPropertyOptional({ enum: DocumentSection, description: 'Override the document section (defaults to the template section)' })
  @IsEnum(DocumentSection)
  @IsOptional()
  section?: DocumentSection;

  @ApiPropertyOptional({ description: 'Override the document title (defaults to the template title)' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'User ID to scope the document to (optional)' })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ description: 'Category ID to assign the document to (optional)' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Company ID (required for Super Admin callers)' })
  @IsUUID()
  @IsOptional()
  companyId?: string;
}
