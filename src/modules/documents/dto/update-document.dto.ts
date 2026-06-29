import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateDocumentDto {
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

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Optional new file to replace the existing file',
  })
  @IsOptional()
  file?: any;
}
