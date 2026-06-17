import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentSection } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateStandardDocumentDto {
  @ApiPropertyOptional({ description: 'The title of the global template' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ enum: DocumentSection, description: 'The document section this template belongs to' })
  @IsEnum(DocumentSection)
  @IsOptional()
  section?: DocumentSection;

  @ApiPropertyOptional({ description: 'Optional description of the template' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Optional new template file to replace the existing one' })
  @IsOptional()
  file?: any;
}
