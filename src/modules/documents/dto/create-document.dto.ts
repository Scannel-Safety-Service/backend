import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentSection } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty({ enum: DocumentSection, description: 'The document section' })
  @IsEnum(DocumentSection)
  section: DocumentSection;

  @ApiPropertyOptional({ description: 'Optional display title of the document' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Optional description of the document' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Optional category ID' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Optional user ID if this document is scoped to a user' })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ description: 'Optional company ID (required for Super Admin)' })
  @IsUUID()
  @IsOptional()
  companyId?: string;

  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'The document file to upload' })
  @IsOptional()
  file?: any;
}
