import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentSection } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UploadProjectDocumentDto {
  @ApiPropertyOptional({ description: 'Optional display title of the document' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Optional description of the document' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: DocumentSection, description: 'The document section (defaults to COMPANY_DOCUMENTS)' })
  @IsEnum(DocumentSection)
  @IsOptional()
  section?: DocumentSection;

  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'The document file to upload' })
  @IsOptional()
  file?: any;
}
