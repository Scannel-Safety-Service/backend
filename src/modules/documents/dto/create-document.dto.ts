import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentSection } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty({ enum: DocumentSection, description: 'The document section' })
  @IsEnum(DocumentSection)
  section: DocumentSection;

  @ApiPropertyOptional({ description: 'Optional category ID' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Optional user ID if this document is scoped to a user' })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'The document file to upload' })
  @IsOptional()
  file?: any;
}
