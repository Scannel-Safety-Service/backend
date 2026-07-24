import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentSection } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateDocumentDto {
  @ApiPropertyOptional({ enum: DocumentSection, description: 'Optional document section' })
  @IsEnum(DocumentSection)
  @IsOptional()
  section?: DocumentSection;
  @ApiPropertyOptional({
    description: 'Optional display title of the document',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Optional description of the document' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Optional category ID' })
  @Transform(({ value }) => (value === 'null' || value === 'undefined' || value === '' ? null : value))
  @IsUUID()
  @IsOptional()
  categoryId?: string | null;

  @ApiPropertyOptional({
    description: 'Optional user ID if this document is scoped to a user',
  })
  @IsUUID()
  @IsOptional()
  userId?: string | null;

  @ApiPropertyOptional({ description: 'Optional review state' })
  @IsBoolean()
  @IsOptional()
  isReviewed?: boolean;

  @ApiPropertyOptional({ description: 'Optional individual ID for Training Qualifications documents' })
  @Transform(({ value }) => (value === 'null' || value === 'undefined' || value === '' ? null : value))
  @IsUUID()
  @IsOptional()
  individualId?: string | null;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Optional new file to replace the existing file',
  })
  @IsOptional()
  file?: any;
}
